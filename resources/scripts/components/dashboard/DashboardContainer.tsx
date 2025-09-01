import React, { useEffect, useState, useMemo } from 'react';
import { Server } from '@/api/server/getServer';
import getServers from '@/api/getServers';

import Spinner from '@/components/elements/Spinner';
import PageContentBlock from '@/components/elements/PageContentBlock';
import useFlash from '@/plugins/useFlash';
import { useStoreState } from 'easy-peasy';
import { usePersistedState } from '@/plugins/usePersistedState';

import tw from 'twin.macro';
import useSWR from 'swr';
import { PaginatedResult } from '@/api/http';
import Pagination from '@/components/elements/Pagination';
import { useLocation } from 'react-router-dom';
import DomainSelector from '@/components/dashboard/DomainSelector';
import CollapsibleServerGroup from '@/components/dashboard/CollapsibleServerGroup';
import { groupServersByDomain, getDomainList, getSortedGroupTree, GroupedServer } from '@/lib/serverGrouping';
import { sendBulkPowerAction, PowerAction } from '@/api/server/power';
import { httpErrorToHuman } from '@/api/http';
import { PlayCircleIcon, StopCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import ConfirmationModal from '@/components/elements/ConfirmationModal';

export default () => {
    const { search } = useLocation();
    const defaultPage = Number(new URLSearchParams(search).get('page') || '1');

    const [page, setPage] = useState(!isNaN(defaultPage) && defaultPage > 0 ? defaultPage : 1);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const uuid = useStoreState((state) => state.user.data!.uuid);
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const [showOnlyAdmin] = usePersistedState(`${uuid}:show_all_servers`, false);
    const [selectedDomain, setSelectedDomain] = usePersistedState(`${uuid}:selected_domain`, '');

    // 全局展开/折叠状态管理
    const [expandAllTrigger, setExpandAllTrigger] = useState(0);
    const [collapseAllTrigger, setCollapseAllTrigger] = useState(0);
    
    // 展开状态持久化存储
    const [expandedGroupsArray, setExpandedGroupsArray] = usePersistedState<string[]>(`${uuid}:expanded_groups`, []);
    const expandedGroups = useMemo(() => new Set(expandedGroupsArray), [expandedGroupsArray]);

    // 确认弹窗状态
    const [confirmAction, setConfirmAction] = useState<{ action: PowerAction; visible: boolean }>({
        action: 'start',
        visible: false,
    });

    const { data: servers, error } = useSWR<PaginatedResult<Server>>(
        ['/api/client/servers', showOnlyAdmin && rootAdmin, page],
        () => getServers({ page, type: 'admin-all' })
    );

    // 分组实例数据
    const { domainList, selectedDomainData, groupTree, currentDomain } = useMemo(() => {
        if (!servers?.items) {
            return {
                domainList: [],
                selectedDomainData: null,
                groupTree: null,
                currentDomain: '',
            };
        }

        const groups = groupServersByDomain(servers.items);
        const domains = getDomainList(groups);

        // 如果selectedDomain为空且有域名列表，优先选择有分组树的域
        let currentDomain = selectedDomain;
        if (!currentDomain && domains.length > 0) {
            // 优先选择有分组树的域名
            const domainWithGroups = domains.find((domain) => {
                const data = groups.get(domain);
                return data && data.groupTree.size > 0;
            });
            currentDomain = domainWithGroups || domains[0] || '';
        }
        const domainData = groups.get(currentDomain || '');
        const tree = domainData ? getSortedGroupTree(groups, currentDomain || '') : new Map();

        return {
            domainGroups: groups,
            domainList: domains,
            selectedDomainData: domainData,
            groupTree: tree,
            currentDomain,
        };
    }, [servers?.items, selectedDomain]);

    // 自动设置第一个域为选中域
    useEffect(() => {
        if (!selectedDomain && currentDomain) {
            setSelectedDomain(currentDomain);
        }
    }, [currentDomain, selectedDomain]);

    // 处理展开状态变化
    const handleGroupExpandChange = (groupPath: string, isExpanded: boolean) => {
        setExpandedGroupsArray((prev) => {
            const currentArray = prev || [];
            if (isExpanded) {
                return currentArray.includes(groupPath) ? currentArray : [...currentArray, groupPath];
            } else {
                return currentArray.filter(path => path !== groupPath);
            }
        });
    };
    
    // 检查组是否展开（包括子组）
    const isGroupExpanded = (groupPath: string) => {
        return expandedGroups.has(groupPath);
    };

    // 处理全局展开/折叠
    const handleExpandAll = () => {
        if (groupTree) {
            const allGroupPaths: string[] = [];
            const collectAllPaths = (tree: Map<string, any>, prefix = '') => {
                tree.forEach((node, key) => {
                    const fullPath = prefix ? `${prefix}/${key}` : key;
                    allGroupPaths.push(fullPath);
                    if (node.children && node.children.size > 0) {
                        collectAllPaths(node.children, fullPath);
                    }
                });
            };
            collectAllPaths(groupTree);
            setExpandedGroupsArray(allGroupPaths);
        }
        setExpandAllTrigger((prev) => prev + 1);
    };

    const handleCollapseAll = () => {
        setExpandedGroupsArray([]);
        setCollapseAllTrigger((prev) => prev + 1);
    };

    // 处理批量操作
    const handleBulkAction = async (servers: GroupedServer[], action: PowerAction) => {
        try {
            const result = await sendBulkPowerAction(servers, action);

            if (result.successful.length > 0) {
                console.log(`Successfully ${action}ed ${result.successful.length} servers`);
                // You could show a success toast notification here
            }

            if (result.failed.length > 0) {
                console.error(`Failed to ${action} ${result.failed.length} servers:`, result.failed);
                // You could show an error toast notification here
            }
        } catch (error) {
            console.error(`Bulk ${action} failed:`, httpErrorToHuman(error));
        }
    };

    // 处理域级别的批量操作
    const handleDomainBulkAction = async (action: PowerAction) => {
        if (selectedDomainData && selectedDomainData.servers.length > 0) {
            await handleBulkAction(selectedDomainData.servers, action);
            setConfirmAction({ action, visible: false });
        }
    };

    // 显示确认弹窗
    const showConfirmation = (action: PowerAction) => {
        setConfirmAction({ action, visible: true });
    };

    // 获取操作的中文名称
    const getActionName = (action: PowerAction) => {
        switch (action) {
            case 'start':
                return '启动';
            case 'stop':
                return '停止';
            case 'restart':
                return '重启';
            default:
                return action;
        }
    };

    useEffect(() => {
        if (!servers) return;
        if (servers.pagination.currentPage > 1 && !servers.items.length) {
            setPage(1);
        }
    }, [servers?.pagination.currentPage]);

    useEffect(() => {
        // Don't use react-router to handle changing this part of the URL, otherwise it
        // triggers a needless re-render. We just want to track this in the URL incase the
        // user refreshes the page.
        window.history.replaceState(null, document.title, `/${page <= 1 ? '' : `?page=${page}`}`);
    }, [page]);

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'dashboard', error });
        if (!error) clearFlashes('dashboard');
    }, [error]);

    return (
        <PageContentBlock title={'仪表盘'} showFlashKey={'dashboard'}>
            {!servers ? (
                <Spinner centered size={'large'} />
            ) : (
                <>
                    {/* 域选择器 */}
                    <div css={tw`mb-4`}>
                        <DomainSelector
                            domains={domainList}
                            selectedDomain={selectedDomain || (domainList.length > 0 ? domainList[0] : '')}
                            onDomainChange={setSelectedDomain}
                            serverCount={selectedDomainData?.servers.length || 0}
                            onBulkAction={async (action) => {
                                if (selectedDomainData) {
                                    await handleBulkAction(selectedDomainData.servers, action);
                                }
                            }}
                        />
                    </div>

                    {/* 一键展开/折叠按钮和批量操作按钮 */}
                    {groupTree && groupTree.size > 0 && (
                        <div css={tw`mb-4 flex items-center justify-between`}>
                            <div css={tw`flex items-center space-x-2`}>
                                <button
                                    onClick={handleExpandAll}
                                    css={tw`px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors duration-150 flex items-center space-x-1`}
                                >
                                    <span>展开所有组</span>
                                </button>
                                <button
                                    onClick={handleCollapseAll}
                                    css={tw`px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium rounded transition-colors duration-150 flex items-center space-x-1`}
                                >
                                    <span>折叠所有组</span>
                                </button>
                            </div>
                            {/* 批量操作按钮 */}
                            {selectedDomainData && selectedDomainData.servers.length > 0 && (
                                <div css={tw`flex items-center space-x-2`}>
                                    <button
                                        onClick={() => showConfirmation('start')}
                                        css={tw`px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded transition-colors duration-150 flex items-center space-x-1`}
                                    >
                                        <PlayCircleIcon css={tw`w-4 h-4`} />
                                        <span>启动全部</span>
                                    </button>
                                    <button
                                        onClick={() => showConfirmation('stop')}
                                        css={tw`px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded transition-colors duration-150 flex items-center space-x-1`}
                                    >
                                        <StopCircleIcon css={tw`w-4 h-4`} />
                                        <span>停止全部</span>
                                    </button>
                                    <button
                                        onClick={() => showConfirmation('restart')}
                                        css={tw`px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium rounded transition-colors duration-150 flex items-center space-x-1`}
                                    >
                                        <ArrowPathIcon css={tw`w-4 h-4`} />
                                        <span>重启全部</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <Pagination data={servers} onPageSelect={setPage}>
                        {({ items }) =>
                            items.length > 0 ? (
                                selectedDomainData && selectedDomainData.servers.length > 0 ? (
                                    <div css={tw`space-y-2`}>
                                        {groupTree &&
                                            Array.from(groupTree.entries()).map(([groupPath, groupNode]) => (
                                                <CollapsibleServerGroup
                                                    key={groupPath}
                                                    groupNode={groupNode}
                                                    level={0}
                                                    groupPath={groupPath}
                                                    onBulkAction={handleBulkAction}
                                                    expandAllTrigger={expandAllTrigger}
                                                    collapseAllTrigger={collapseAllTrigger}
                                                    isExpanded={expandedGroups.has(groupPath)}
                                                    onExpandChange={handleGroupExpandChange}
                                                    isGroupExpanded={isGroupExpanded}
                                                />
                                            ))}
                                    </div>
                                ) : (
                                    <p css={tw`text-center text-sm text-neutral-400`}>所选域中没有实例。</p>
                                )
                            ) : (
                                <p css={tw`text-center text-sm text-neutral-400`}>{'暂时没有任何实例'}</p>
                            )
                        }
                    </Pagination>
                </>
            )}

            {/* 确认弹窗 */}
            <ConfirmationModal
                visible={confirmAction.visible}
                title={`确认${getActionName(confirmAction.action)}操作`}
                buttonText={`${getActionName(confirmAction.action)}全部实例`}
                onConfirmed={() => handleDomainBulkAction(confirmAction.action)}
                showSpinnerOverlay={false}
                onModalDismissed={() => setConfirmAction({ action: confirmAction.action, visible: false })}
            >
                您确定要{getActionName(confirmAction.action)}当前域中的所有实例吗？此操作将影响{' '}
                {selectedDomainData?.servers.length || 0} 个实例。
            </ConfirmationModal>
        </PageContentBlock>
    );
};
