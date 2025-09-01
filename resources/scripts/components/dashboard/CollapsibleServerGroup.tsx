import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { PowerIcon, PlayIcon, StopIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Menu, Transition } from '@headlessui/react';

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
    expandAllTrigger?: number;
    collapseAllTrigger?: number;
}

const GroupContainer = styled.div<{ level: number }>`
    ${tw`mb-3 bg-neutral-900/50 border border-neutral-700 rounded-lg shadow-sm overflow-hidden`}
    ${tw`border-l-4 border-l-blue-500`}
`;

const GroupHeader = styled.div`
    ${tw`flex items-center justify-between bg-neutral-700 hover:bg-neutral-600 transition-colors duration-150 p-4 border-b border-neutral-600 cursor-pointer`}
`;

const GroupInfo = styled.div`
    ${tw`flex items-center justify-between w-full`}
`;

const GroupLeftSection = styled.div`
    ${tw`flex items-center space-x-3`}
`;

const GroupRightSection = styled.div`
    ${tw`flex items-center space-x-3 relative`}
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
    ${tw`overflow-hidden transition-all duration-300 ease-in-out`}
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
    onBulkAction,
    className,
    expandAllTrigger,
    collapseAllTrigger,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
    const buttonRef = useRef<HTMLDivElement>(null);
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 监听外部触发器变化
    useEffect(() => {
        if (expandAllTrigger && expandAllTrigger > 0) {
            setIsExpanded(true);
        }
    }, [expandAllTrigger]);

    useEffect(() => {
        if (collapseAllTrigger && collapseAllTrigger > 0) {
            setIsExpanded(false);
        }
    }, [collapseAllTrigger]);
    const totalServerCount = getTotalServerCount(groupNode);
    const allServers = getAllServers(groupNode);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const updateMenuPosition = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom + window.scrollY,
                right: window.innerWidth - rect.right - window.scrollX - 10,
            });
        }
    };

    const handleMenuEnter = () => {
        // 清除之前的延迟关闭
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        updateMenuPosition();
        setIsMenuOpen(true);
    };

    const handleMenuLeave = () => {
        // 延迟关闭菜单，给用户时间移动到菜单上
        closeTimeoutRef.current = setTimeout(() => {
            setIsMenuOpen(false);
        }, 150);
    };

    const handleMenuMouseEnter = () => {
        // 清除延迟关闭
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        setIsMenuOpen(true);
    };

    const handleMenuMouseLeave = () => {
        setIsMenuOpen(false);
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
                            <Menu as='div' className='relative inline-block text-left'>
                                <div onMouseEnter={handleMenuEnter} onMouseLeave={handleMenuLeave}>
                                    <Menu.Button as={ActionTrigger} ref={buttonRef}>
                                        <PowerIcon className='w-7 h-7' />
                                    </Menu.Button>
                                    {isMenuOpen &&
                                        createPortal(
                                            <Transition
                                                show={isMenuOpen}
                                                enter='transition ease-out duration-100'
                                                enterFrom='transform opacity-0 scale-95'
                                                enterTo='transform opacity-100 scale-100'
                                                leave='transition ease-in duration-75'
                                                leaveFrom='transform opacity-100 scale-100'
                                                leaveTo='transform opacity-0 scale-95'
                                            >
                                                <Menu.Items
                                                    className='fixed z-[99999] min-w-max origin-top-right rounded-md bg-neutral-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none'
                                                    style={{
                                                        top: `${menuPosition.top}px`,
                                                        right: `${menuPosition.right}px`,
                                                    }}
                                                    onMouseEnter={handleMenuMouseEnter}
                                                    onMouseLeave={handleMenuMouseLeave}
                                                >
                                                    <div className='py-1'>
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button
                                                                    onClick={(e: React.MouseEvent) => {
                                                                        e.stopPropagation();
                                                                        handleBulkAction('start', e);
                                                                    }}
                                                                    className={`${
                                                                        active
                                                                            ? 'bg-neutral-700 text-neutral-100'
                                                                            : 'text-neutral-200'
                                                                    } flex items-center space-x-2 w-full px-4 py-2 text-left text-sm hover:bg-neutral-700 hover:text-neutral-100`}
                                                                >
                                                                    <PlayIcon className='w-4 h-4' />
                                                                    <span>启动</span>
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button
                                                                    onClick={(e: React.MouseEvent) => {
                                                                        e.stopPropagation();
                                                                        handleBulkAction('stop', e);
                                                                    }}
                                                                    className={`${
                                                                        active
                                                                            ? 'bg-neutral-700 text-neutral-100'
                                                                            : 'text-neutral-200'
                                                                    } flex items-center space-x-2 w-full px-4 py-2 text-left text-sm hover:bg-neutral-700 hover:text-neutral-100`}
                                                                >
                                                                    <StopIcon className='w-4 h-4' />
                                                                    <span>停止</span>
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button
                                                                    onClick={(e: React.MouseEvent) => {
                                                                        e.stopPropagation();
                                                                        handleBulkAction('restart', e);
                                                                    }}
                                                                    className={`${
                                                                        active
                                                                            ? 'bg-neutral-700 text-neutral-100'
                                                                            : 'text-neutral-200'
                                                                    } flex items-center space-x-2 w-full px-4 py-2 text-left text-sm hover:bg-neutral-700 hover:text-neutral-100`}
                                                                >
                                                                    <ArrowPathIcon className='w-4 h-4' />
                                                                    <span>重启</span>
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                    </div>
                                                </Menu.Items>
                                            </Transition>,
                                            document.body
                                        )}
                                </div>
                            </Menu>
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
                        {Array.from(groupNode.children.values()).map((childNode) => (
                            <CollapsibleServerGroup
                                key={childNode.name}
                                groupNode={childNode}
                                level={level + 1}
                                onBulkAction={onBulkAction}
                                expandAllTrigger={expandAllTrigger}
                                collapseAllTrigger={collapseAllTrigger}
                            />
                        ))}
                    </ChildGroupsContainer>
                )}
            </ContentContainer>
        </GroupContainer>
    );
};

export default CollapsibleServerGroup;
