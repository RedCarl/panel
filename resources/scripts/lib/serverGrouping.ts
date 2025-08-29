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
 * 格式: [域名]#[序号]@[服务器组1]:[服务器组2]:[服务器组3]
 * 例如: example.com#001@web[1]:frontend[2]:nginx[3]
 */
export function parseServerName(serverName: string): ParsedServerInfo {
    const defaultInfo: ParsedServerInfo = {
        domain: 'default',
        groups: [],
        sequence: serverName,
        originalName: serverName,
        displayName: serverName,
    };

    try {
        // 调试：打印解析过程
        console.log('正在解析服务器名称:', serverName);

        // 匹配格式: [域名]#[序号]@[分组信息]
        const match = serverName.match(/^([^#]*)#([^@]+)@(.+)$/);
        console.log('正则匹配结果:', match);

        if (!match) {
            console.log('匹配失败，尝试解析纯分组格式');
            // 尝试匹配纯分组格式: GROUP[priority]:GROUP[priority]
            const groupOnlyMatch = serverName.match(/^([A-Z]+\[\d+\](?::[A-Z]+\[\d+\])*)$/);
            if (groupOnlyMatch) {
                console.log('匹配到纯分组格式:', groupOnlyMatch);
                const groups: ServerGroup[] = [];
                const groupParts = serverName.split(':');

                // 只处理第一个分组作为主分组
                let serverDisplayName = serverName;
                if (groupParts.length > 0 && groupParts[0].trim()) {
                    const firstGroupPart = groupParts[0].trim();
                    const groupMatch = firstGroupPart.match(/^([^[]+)(?:\[(\d+)\])?$/);
                    if (groupMatch) {
                        const [, groupName, priorityStr] = groupMatch;
                        const priority = priorityStr ? parseInt(priorityStr, 10) : 999;
                        groups.push({
                            name: groupName.trim(),
                            priority,
                            level: 0,
                        });
                    }
                }

                // 如果有第二个分组，将其作为服务器显示名称
                if (groupParts.length > 1 && groupParts[1].trim()) {
                    const secondGroupPart = groupParts[1].trim();
                    const nameMatch = secondGroupPart.match(/^([^[]+)/);
                    if (nameMatch) {
                        serverDisplayName = nameMatch[1].trim();
                    }
                }

                const result = {
                    domain: 'default',
                    groups,
                    sequence: '0',
                    originalName: serverName,
                    displayName: serverDisplayName,
                };
                console.log('纯分组格式解析结果:', result);
                return result;
            }

            console.log('完全匹配失败，返回默认信息');
            return defaultInfo;
        }

        const [, domainPart, sequencePart, groupsPart] = match;

        // 解析域名
        const domain = domainPart.trim() || 'default';

        // 解析序号
        const sequence = sequencePart.trim();

        // 解析服务器组 - 简化为只保留第一层分组
        const groups: ServerGroup[] = [];
        let serverDisplayName = serverName;

        // 按冒号分割分组信息
        const groupParts = groupsPart.split(':');

        // 只处理第一个分组作为主分组
        if (groupParts.length > 0 && groupParts[0].trim()) {
            const firstGroupPart = groupParts[0].trim();
            const groupMatch = firstGroupPart.match(/^([^[]+)(?:\[(\d+)\])?$/);

            if (groupMatch) {
                const [, groupName, priorityStr] = groupMatch;
                const priority = priorityStr ? parseInt(priorityStr, 10) : 999;

                groups.push({
                    name: groupName.trim(),
                    priority,
                    level: 1,
                });
            }
        }

        // 如果有第二个分组，将其作为服务器显示名称
        if (groupParts.length > 1 && groupParts[1].trim()) {
            const secondGroupPart = groupParts[1].trim();
            const nameMatch = secondGroupPart.match(/^([^[]+)/);
            if (nameMatch) {
                serverDisplayName = nameMatch[1].trim();
            }
        }

        const result = {
            domain,
            groups,
            sequence,
            originalName: serverName,
            displayName: serverDisplayName,
        };

        // 调试：打印解析结果
        console.log('解析结果:', result);

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
    const match = serverName.match(/^([^#]*)#([^@]+)@(.+)$/);
    return !!match;
}
