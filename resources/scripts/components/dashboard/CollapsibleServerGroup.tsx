import React, { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/solid';
import { PlayIcon, StopIcon, RefreshIcon } from '@heroicons/react/outline';
import tw from 'twin.macro';
import styled from 'styled-components/macro';

import ServerRow from '@/components/dashboard/ServerRow';
import { ServerGroupNode, GroupedServer } from '@/lib/serverGrouping';
import { sendBulkPowerAction, PowerAction } from '@/api/server/power';
import { httpErrorToHuman } from '@/api/http';

interface Props {
    groupNode: ServerGroupNode;
    level: number;
    onBulkAction?: (servers: GroupedServer[], action: PowerAction) => void;
    className?: string;
}

const GroupContainer = styled.div<{ level: number }>`
    margin-left: ${(props) => props.level * 1}rem;
`;

const GroupHeader = styled.div`
    ${tw`flex items-center justify-between bg-neutral-700 hover:bg-neutral-600 transition-colors duration-150 p-3 rounded cursor-pointer`}
`;

const GroupInfo = styled.div`
    ${tw`flex items-center space-x-3`}
`;

const GroupName = styled.span`
    ${tw`font-medium text-neutral-200`}
`;

const ServerCount = styled.span`
    ${tw`text-sm text-neutral-400 bg-neutral-600 px-2 py-1 rounded`}
`;

const ActionContainer = styled.div`
    ${tw`flex items-center space-x-2`}
`;

const ActionButton = styled.button<{ variant?: 'start' | 'stop' | 'restart' }>`
    ${tw`px-2 py-1 rounded text-xs font-medium transition-colors duration-150 flex items-center space-x-1`}

    ${(props) => {
        switch (props.variant) {
            case 'start':
                return tw`bg-green-600 hover:bg-green-500 text-white`;
            case 'stop':
                return tw`bg-red-600 hover:bg-red-500 text-white`;
            case 'restart':
                return tw`bg-yellow-600 hover:bg-yellow-500 text-white`;
            default:
                return tw`bg-neutral-600 hover:bg-neutral-500 text-neutral-200`;
        }
    }}
`;

const ContentContainer = styled.div<{ isExpanded: boolean }>`
    ${tw`overflow-hidden transition-all duration-200`}
    max-height: ${(props) => (props.isExpanded ? '1000px' : '0')};
`;

const ServersContainer = styled.div`
    ${tw`space-y-2 mt-2`}
`;

const ChildGroupsContainer = styled.div`
    ${tw`space-y-2 mt-2`}
`;

// 递归计算所有服务器数量
const getTotalServerCount = (node: ServerGroupNode): number => {
    let count = node.servers.length;
    for (const child of node.children.values()) {
        count += getTotalServerCount(child);
    }
    return count;
};

// 递归收集所有服务器
const getAllServers = (node: ServerGroupNode): GroupedServer[] => {
    let servers = [...node.servers];
    for (const child of node.children.values()) {
        servers = servers.concat(getAllServers(child));
    }
    return servers;
};

const CollapsibleServerGroup: React.FC<Props> = ({ groupNode, level, onBulkAction, className }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const totalServerCount = getTotalServerCount(groupNode);
    const allServers = getAllServers(groupNode);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
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
                    {isExpanded ? (
                        <ChevronDownIcon className='w-4 h-4 text-neutral-400' />
                    ) : (
                        <ChevronRightIcon className='w-4 h-4 text-neutral-400' />
                    )}
                    <GroupName>{groupNode.name}</GroupName>
                    <ServerCount>{totalServerCount} 台服务器</ServerCount>
                </GroupInfo>

                {onBulkAction && (
                    <ActionContainer>
                        <ActionButton
                            variant='start'
                            onClick={(e) => handleBulkAction('start', e)}
                            title='启动组内所有服务器'
                        >
                            <PlayIcon className='w-3 h-3' />
                            <span>启动</span>
                        </ActionButton>

                        <ActionButton
                            variant='stop'
                            onClick={(e) => handleBulkAction('stop', e)}
                            title='停止组内所有服务器'
                        >
                            <StopIcon className='w-3 h-3' />
                            <span>停止</span>
                        </ActionButton>

                        <ActionButton
                            variant='restart'
                            onClick={(e) => handleBulkAction('restart', e)}
                            title='重启组内所有服务器'
                        >
                            <RefreshIcon className='w-3 h-3' />
                            <span>重启</span>
                        </ActionButton>
                    </ActionContainer>
                )}
            </GroupHeader>

            <ContentContainer isExpanded={isExpanded}>
                {/* 渲染子组 */}
                {groupNode.children.size > 0 && (
                    <ChildGroupsContainer>
                        {Array.from(groupNode.children.values()).map((childNode) => (
                            <CollapsibleServerGroup
                                key={childNode.name}
                                groupNode={childNode}
                                level={level + 1}
                                onBulkAction={onBulkAction}
                            />
                        ))}
                    </ChildGroupsContainer>
                )}

                {/* 渲染直属服务器 */}
                {groupNode.servers.length > 0 && (
                    <ServersContainer>
                        {groupNode.servers.map((groupedServer) => (
                            <ServerRow key={groupedServer.uuid} server={groupedServer} />
                        ))}
                    </ServersContainer>
                )}
            </ContentContainer>
        </GroupContainer>
    );
};

export default CollapsibleServerGroup;
