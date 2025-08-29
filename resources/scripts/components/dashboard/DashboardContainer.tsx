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

export default () => {
    const { search } = useLocation();
    const defaultPage = Number(new URLSearchParams(search).get('page') || '1');

    const [page, setPage] = useState(!isNaN(defaultPage) && defaultPage > 0 ? defaultPage : 1);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const uuid = useStoreState((state) => state.user.data!.uuid);
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const [showOnlyAdmin] = usePersistedState(`${uuid}:show_all_servers`, false);
    const [selectedDomain, setSelectedDomain] = useState('');

    const { data: servers, error } = useSWR<PaginatedResult<Server>>(
        ['/api/client/servers', showOnlyAdmin && rootAdmin, page],
        () => getServers({ page })
    );

    // 分组服务器数据
    const { domainList, selectedDomainData, groupTree, currentDomain } = useMemo(() => {
        if (!servers?.items) {
            return {
                domainList: [],
                selectedDomainData: null,
                groupTree: null,
            };
        }

        // 调试：打印原始服务器数据
        console.log('原始数据:', servers);
        console.log('原始服务器数据:', servers.items);
        console.log(
            '服务器名称列表:',
            servers.items.map((s) => s.name)
        );

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
            currentDomain = domainWithGroups || domains[0];
        }
        const domainData = groups.get(currentDomain);
        const tree = domainData ? getSortedGroupTree(groups, currentDomain) : new Map();

        // 调试：打印分组结果
        console.log('分组结果:', groups);
        console.log('域名列表:', domains);
        console.log('当前选中域:', currentDomain);
        console.log('当前域数据:', domainData);
        console.log('分组树:', tree);

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
            {/* {rootAdmin && (
                <div css={tw`mb-2 flex justify-end items-center`}>
                    <p css={tw`uppercase text-xs text-neutral-400 mr-2`}>
                        {showOnlyAdmin ? '显示其他人的服务器' : '显示你的服务器'}
                    </p>
                    <Switch
                        name={'show_all_servers'}
                        defaultChecked={showOnlyAdmin}
                        onChange={() => setShowOnlyAdmin((s) => !s)}
                    />
                </div>
            )} */}
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
                                                    onBulkAction={handleBulkAction}
                                                />
                                            ))}
                                    </div>
                                ) : (
                                    <p css={tw`text-center text-sm text-neutral-400`}>所选域中没有服务器。</p>
                                )
                            ) : (
                                <p css={tw`text-center text-sm text-neutral-400`}>{'暂时没有任何服务器'}</p>
                            )
                        }
                    </Pagination>
                </>
            )}
        </PageContentBlock>
    );
};
