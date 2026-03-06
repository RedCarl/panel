import { Server } from '@/api/server/getServer';

/**
 * 服务器分组信息
 */
export interface ServerGroup {
    name: string; // 组名
    priority: number; // 优先级，数字越小优先级越高
    level: number; // 层级，从1开始
}

/**
 * 解析后的服务器信息
 */
export interface ParsedServerInfo {
    domain: string; // 域名
    groups: ServerGroup[]; // 分组层级
    sequence: string; // 序号
    originalName: string; // 原始名称
    displayName: string; // 显示名称
}

/**
 * 带分组信息的服务器
 */
export interface GroupedServer extends Server {
    parsedInfo: ParsedServerInfo;
}

/**
 * 服务器分组树节点
 */
export interface ServerGroupNode {
    name: string;
    priority: number;
    level: number;
    servers: GroupedServer[];
    children: Map<string, ServerGroupNode>;
    serverCount: number;
}

/**
 * 域分组
 */
export interface DomainGroup {
    domain: string;
    servers: GroupedServer[];
    groupTree: Map<string, ServerGroupNode>;
    serverCount: number;
}

/**
 * 解析服务器名称
 * 格式: 域#分组[权重]:分组[权重]
 * 例如: example.com#web[1]:frontend[2]
 * 权重如果没写，默认为999
 */
export function parseServerName(serverName: string): ParsedServerInfo {
    const defaultInfo: ParsedServerInfo = {
        domain: 'default',
        groups: [],
        sequence: '0',
        originalName: serverName,
        displayName: serverName,
    };

    try {
        // 匹配新格式: 域#分组[权重]:分组[权重]
        const match = serverName.match(/^([^#]+)#(.+)$/);

        if (!match) {
            console.log('匹配失败，返回默认信息');
            return defaultInfo;
        }

        const [, domainPart, groupsPart] = match;

        // 解析域名
        const domain = domainPart.trim() || 'default';

        // 解析分组部分 - 格式: 分组名[权重]:分组名[权重]:...
        const groups: ServerGroup[] = [];
        const groupParts = groupsPart.split(':');

        groupParts.forEach((groupPart, index) => {
            const groupMatch = groupPart.trim().match(/^([^[]+)(?:\[(\d+)\])?$/);
            if (groupMatch) {
                const [, groupName, priorityStr] = groupMatch;
                const priority = priorityStr ? parseInt(priorityStr, 10) : 999;
                groups.push({
                    name: groupName.trim(),
                    priority,
                    level: index + 1,
                });
            }
        });

        // 使用最后一个分组作为显示名称
        const lastGroup = groups[groups.length - 1];
        const serverDisplayName = lastGroup ? lastGroup.name : serverName;
        const serverPriority = lastGroup ? lastGroup.priority : 999;

        const result = {
            domain,
            groups,
            sequence: serverPriority.toString(),
            originalName: serverName,
            displayName: serverDisplayName,
        };

        return result;
    } catch (error) {
        console.warn('Failed to parse server name:', serverName, error);
        return defaultInfo;
    }
}

/**
 * 按优先级排序服务器组
 */
export function sortGroupsByPriority(groups: ServerGroup[]): ServerGroup[] {
    return [...groups].sort((a, b) => a.priority - b.priority);
}

/**
 * 创建分组树节点
 */
function createGroupNode(name: string, priority: number, level: number): ServerGroupNode {
    return {
        name,
        priority,
        level,
        servers: [],
        children: new Map(),
        serverCount: 0,
    };
}

/**
 * 将服务器添加到分组树中
 */
function addServerToGroupTree(
    tree: Map<string, ServerGroupNode>,
    server: GroupedServer,
    groups: ServerGroup[],
    currentLevel = 0
): void {
    if (currentLevel >= groups.length) {
        // 已到达最深层级，直接添加服务器
        return;
    }

    const currentGroup = groups[currentLevel];
    const groupKey = currentGroup.name;

    // 获取或创建当前层级的节点
    if (!tree.has(groupKey)) {
        tree.set(groupKey, createGroupNode(currentGroup.name, currentGroup.priority, currentGroup.level));
    }

    const node = tree.get(groupKey)!;
    node.serverCount++;

    if (currentLevel === groups.length - 1) {
        // 最后一层，添加服务器
        node.servers.push(server);
    } else {
        // 继续递归到下一层
        addServerToGroupTree(node.children, server, groups, currentLevel + 1);
    }
}

/**
 * 按域分组服务器
 */
export function groupServersByDomain(servers: Server[]): Map<string, DomainGroup> {
    const domainGroups = new Map<string, DomainGroup>();

    servers.forEach((server) => {
        const parsedInfo = parseServerName(server.name);
        const groupedServer: GroupedServer = {
            ...server,
            parsedInfo,
        };

        const domain = parsedInfo.domain;

        // 获取或创建域分组
        if (!domainGroups.has(domain)) {
            domainGroups.set(domain, {
                domain,
                servers: [],
                groupTree: new Map(),
                serverCount: 0,
            });
        }

        const domainGroup = domainGroups.get(domain)!;
        domainGroup.servers.push(groupedServer);
        domainGroup.serverCount++;

        // 添加到分组树
        if (parsedInfo.groups.length > 0) {
            addServerToGroupTree(domainGroup.groupTree, groupedServer, parsedInfo.groups);
        }
    });

    return domainGroups;
}

/**
 * 获取所有域名列表，按字母顺序排序
 */
export function getDomainList(domainGroups: Map<string, DomainGroup>): string[] {
    const domains = Array.from(domainGroups.keys());
    return domains.sort((a, b) => {
        // default域排在最前面
        if (a === 'default' && b !== 'default') return -1;
        if (b === 'default' && a !== 'default') return 1;
        return a.localeCompare(b);
    });
}

/**
 * 递归排序分组树
 */
export function sortGroupTree(tree: Map<string, ServerGroupNode>): Map<string, ServerGroupNode> {
    const sortedEntries = Array.from(tree.entries()).sort(([, a], [, b]) => a.priority - b.priority);

    const sortedTree = new Map<string, ServerGroupNode>();

    sortedEntries.forEach(([key, node]) => {
        // 递归排序子节点
        if (node.children.size > 0) {
            node.children = sortGroupTree(node.children);
        }

        // 排序服务器列表
        node.servers.sort((a, b) => a.parsedInfo.sequence.localeCompare(b.parsedInfo.sequence));

        sortedTree.set(key, node);
    });

    return sortedTree;
}

/**
 * 获取指定域的排序后分组树
 */
export function getSortedGroupTree(
    domainGroups: Map<string, DomainGroup>,
    domain: string
): Map<string, ServerGroupNode> | null {
    const domainGroup = domainGroups.get(domain);
    if (!domainGroup) return null;

    return sortGroupTree(domainGroup.groupTree);
}

/**
 * 获取分组路径字符串（用于显示）
 */
export function getGroupPath(groups: ServerGroup[]): string {
    return groups.map((group) => `:${group.name}`).join('');
}

/**
 * 检查服务器名称是否符合分组格式
 */
export function isValidGroupedServerName(serverName: string): boolean {
    const match = serverName.match(/^([^#]+)#(.+)$/);
    return !!match;
}
