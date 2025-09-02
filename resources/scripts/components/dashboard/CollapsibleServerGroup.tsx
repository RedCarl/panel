import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { PowerIcon, PlayIcon, StopIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

import tw from 'twin.macro';
import styled from 'styled-components/macro';

import ServerRow from '@/components/dashboard/ServerRow';
import { ServerGroupNode, GroupedServer } from '@/lib/serverGrouping';
import { sendBulkPowerAction, PowerAction } from '@/api/server/power';
import { httpErrorToHuman } from '@/api/http';

interface Props {
    groupNode: ServerGroupNode;
    level: number;
    groupPath?: string;
    onBulkAction?: (servers: GroupedServer[], action: PowerAction) => void;
    className?: string;
    expandAllTrigger?: number;
    collapseAllTrigger?: number;
    isExpanded?: boolean;
    onExpandChange?: (groupPath: string, isExpanded: boolean) => void;
    isGroupExpanded?: (groupPath: string) => boolean;
}

const GroupContainer = styled.div<{ level: number }>`
    ${tw`mb-3 bg-neutral-900/50 border border-neutral-700 rounded-lg shadow-sm`}
    ${tw`border-l-4 border-l-blue-500`}
`;

const GroupHeader = styled.div`
    ${tw`flex items-center justify-between bg-neutral-900/50 transition-colors duration-150 p-2 border-b border-neutral-600 cursor-pointer rounded-t-lg`}
`;

const GroupInfo = styled.div`
    ${tw`flex items-center justify-between w-full`}
`;

const GroupLeftSection = styled.div`
    ${tw`flex items-center space-x-3`}
`;

const GroupRightSection = styled.div`
    ${tw`flex items-center space-x-3 relative overflow-visible`}
`;

const GroupName = styled.span`
    ${tw`font-medium text-neutral-200`}
`;

const ServerCount = styled.span`
    ${tw`text-sm text-neutral-400 bg-neutral-600 px-2 py-1 rounded`}
`;

const ActionTrigger = styled.div`
    ${tw`flex items-center space-x-1 text-neutral-400 hover:text-neutral-200 transition-colors duration-150 px-2 py-1 rounded`}
`;

const ContentContainer = styled.div<{ isExpanded: boolean }>`
    ${tw`overflow-hidden transition-all duration-300 ease-in-out rounded-b-lg`}
    max-height: ${(props) => (props.isExpanded ? '2000px' : '0')};
    opacity: ${(props) => (props.isExpanded ? '1' : '0')};
`;

const ServersContainer = styled.div`
    ${tw`space-y-2 p-3 bg-neutral-900`}
`;

const ChildGroupsContainer = styled.div`
    ${tw`space-y-3 p-3 bg-neutral-900`}
`;

// 递归计算所有实例数量
const getTotalServerCount = (node: ServerGroupNode): number => {
    let count = node.servers.length;
    for (const child of node.children.values()) {
        count += getTotalServerCount(child);
    }
    return count;
};

// 递归收集所有实例
const getAllServers = (node: ServerGroupNode): GroupedServer[] => {
    let servers = [...node.servers];
    for (const child of node.children.values()) {
        servers = servers.concat(getAllServers(child));
    }
    return servers;
};

const CollapsibleServerGroup: React.FC<Props> = ({
    groupNode,
    level,
    groupPath,
    onBulkAction,
    className,
    expandAllTrigger,
    collapseAllTrigger,
    isExpanded: propIsExpanded,
    onExpandChange,
    isGroupExpanded,
}) => {
    const [localIsExpanded, setLocalIsExpanded] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // 使用传入的展开状态，如果没有传入则使用本地状态
    const isExpanded = propIsExpanded !== undefined ? propIsExpanded : localIsExpanded;

    // 监听外部触发器变化
    useEffect(() => {
        if (expandAllTrigger && expandAllTrigger > 0) {
            if (onExpandChange && groupPath) {
                onExpandChange(groupPath, true);
            } else {
                setLocalIsExpanded(true);
            }
        }
    }, [expandAllTrigger]);

    useEffect(() => {
        if (collapseAllTrigger && collapseAllTrigger > 0) {
            if (onExpandChange && groupPath) {
                onExpandChange(groupPath, false);
            } else {
                setLocalIsExpanded(false);
            }
        }
    }, [collapseAllTrigger]);

    const totalServerCount = getTotalServerCount(groupNode);
    const allServers = getAllServers(groupNode);

    // 检查是否为单级单实例组：只有一个实例且没有子组
    const isSingleServerGroup = groupNode.servers.length === 1 && groupNode.children.size === 0;

    // 如果是单级单实例组，直接渲染实例并在上方显示组名
    if (isSingleServerGroup) {
        const server = groupNode.servers[0];
        return (
            <div className={className}>
                <ServerRow server={server} groupName={groupNode.name} />
            </div>
        );
    }

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newExpandedState = !isExpanded;

        if (onExpandChange && groupPath) {
            onExpandChange(groupPath, newExpandedState);
        } else {
            setLocalIsExpanded(newExpandedState);
        }
    };

    const handleBulkAction = async (action: PowerAction, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const result = await sendBulkPowerAction(allServers, action);

            if (result.successful.length > 0) {
                console.log(`Successfully ${action}ed ${result.successful.length} servers in group`);
            }

            if (result.failed.length > 0) {
                console.error(`Failed to ${action} ${result.failed.length} servers:`, result.failed);
            }

            if (onBulkAction) {
                onBulkAction(allServers, action);
            }
        } catch (error) {
            console.error(`Group ${action} failed:`, httpErrorToHuman(error));
        }
    };

    return (
        <GroupContainer level={level} className={className}>
            <GroupHeader onClick={handleToggle}>
                <GroupInfo>
                    <GroupLeftSection>
                        {isExpanded ? (
                            <ChevronDownIcon className='w-4 h-4 text-neutral-400' />
                        ) : (
                            <ChevronRightIcon className='w-4 h-4 text-neutral-400' />
                        )}
                        <GroupName>{groupNode.name}</GroupName>
                    </GroupLeftSection>
                    <GroupRightSection onClick={(e) => e.stopPropagation()}>
                        <ServerCount>共{totalServerCount}个实例</ServerCount>
                        {onBulkAction && <span className='text-neutral-400'>|</span>}
                        {onBulkAction && (
                            <div
                                className='relative inline-block text-left'
                                onMouseEnter={() => setIsMenuOpen(true)}
                                onMouseLeave={() => setIsMenuOpen(false)}
                            >
                                <ActionTrigger>
                                    <PowerIcon className='w-7 h-7' />
                                </ActionTrigger>
                                {isMenuOpen && (
                                    <div className='absolute right-0 z-50 w-24 rounded-md bg-neutral-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none'>
                                        <div className='py-1'>
                                            <button
                                                onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    handleBulkAction('start', e);
                                                    setIsMenuOpen(false);
                                                }}
                                                className='text-neutral-200 flex items-center space-x-2 w-full px-4 py-2 text-left text-sm hover:bg-neutral-700 hover:text-neutral-100'
                                            >
                                                <PlayIcon className='w-4 h-4' />
                                                <span>启动</span>
                                            </button>
                                            <button
                                                onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    handleBulkAction('stop', e);
                                                    setIsMenuOpen(false);
                                                }}
                                                className='text-neutral-200 flex items-center space-x-2 w-full px-4 py-2 text-left text-sm hover:bg-neutral-700 hover:text-neutral-100'
                                            >
                                                <StopIcon className='w-4 h-4' />
                                                <span>停止</span>
                                            </button>
                                            <button
                                                onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    handleBulkAction('restart', e);
                                                    setIsMenuOpen(false);
                                                }}
                                                className='text-neutral-200 flex items-center space-x-2 w-full px-4 py-2 text-left text-sm hover:bg-neutral-700 hover:text-neutral-100'
                                            >
                                                <ArrowPathIcon className='w-4 h-4' />
                                                <span>重启</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </GroupRightSection>
                </GroupInfo>
            </GroupHeader>

            <ContentContainer isExpanded={isExpanded}>
                {/* 渲染直属实例 */}
                {groupNode.servers.length > 0 && (
                    <ServersContainer>
                        {groupNode.servers.map((groupedServer) => (
                            <ServerRow key={groupedServer.uuid} server={groupedServer} />
                        ))}
                    </ServersContainer>
                )}

                {/* 渲染子组 */}
                {groupNode.children.size > 0 && (
                    <ChildGroupsContainer>
                        {Array.from(groupNode.children.values()).map((childNode) => {
                            const childGroupPath = groupPath ? `${groupPath}/${childNode.name}` : childNode.name;
                            return (
                                <CollapsibleServerGroup
                                    key={childNode.name}
                                    groupNode={childNode}
                                    level={level + 1}
                                    groupPath={childGroupPath}
                                    onBulkAction={onBulkAction}
                                    expandAllTrigger={expandAllTrigger}
                                    collapseAllTrigger={collapseAllTrigger}
                                    isExpanded={isGroupExpanded ? isGroupExpanded(childGroupPath) : undefined}
                                    onExpandChange={onExpandChange}
                                    isGroupExpanded={isGroupExpanded}
                                />
                            );
                        })}
                    </ChildGroupsContainer>
                )}
            </ContentContainer>
        </GroupContainer>
    );
};

export default CollapsibleServerGroup;
