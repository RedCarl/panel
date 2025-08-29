import React, { memo, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEthernet, faHdd, faMemory, faMicrochip, faServer } from '@fortawesome/free-solid-svg-icons';
import { PlayIcon, StopIcon, RefreshIcon } from '@heroicons/react/outline';
import { Link } from 'react-router-dom';
import getServerResourceUsage, { ServerPowerState, ServerStats } from '@/api/server/getServerResourceUsage';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import tw from 'twin.macro';
import GreyRowBox from '@/components/elements/GreyRowBox';
import Spinner from '@/components/elements/Spinner';
import styled from 'styled-components/macro';
import isEqual from 'react-fast-compare';
import { GroupedServer } from '@/lib/serverGrouping';
import { sendPowerAction, PowerAction } from '@/api/server/power';
import { httpErrorToHuman } from '@/api/http';

// 优化后的组件结构和样式设计

// Determines if the current value is in an alarm threshold so we can show it in red rather
// than the more faded default style.
const isAlarmState = (current: number, limit: number): boolean => limit > 0 && current / (limit * 1024 * 1024) >= 0.9;

const Icon = memo(
    styled(FontAwesomeIcon)<{ $alarm: boolean }>`
        ${(props) => (props.$alarm ? tw`text-red-400` : tw`text-neutral-500`)};
    `,
    isEqual
);

const StatusIndicatorBox = styled(GreyRowBox)<{ $status: ServerPowerState | undefined }>`
    ${tw`flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 p-4 lg:p-6 rounded-lg border border-neutral-600 hover:border-neutral-500 transition-all duration-200 hover:shadow-md relative`};
    background: ${tw`bg-neutral-700`};

    & .status-bar {
        ${tw`w-1 absolute left-0 top-0 z-20 transition-all duration-300 rounded-r`};
        height: 100%;

        ${({ $status }) =>
            !$status || $status === 'offline'
                ? tw`bg-red-400`
                : $status === 'running'
                ? tw`bg-green-400`
                : tw`bg-yellow-400`};
    }

    &:hover {
        ${tw`border-neutral-400`};

        & .status-bar {
            ${tw`w-1.5`};
        }
    }
`;

const ActionButton = styled.button<{ variant?: 'start' | 'stop' | 'restart' }>`
    ${tw`px-3 py-2 rounded text-sm font-medium transition-all duration-200 flex items-center space-x-1.5 min-w-[80px] justify-center`}

    &:hover {
        ${tw`shadow-md`};
    }

    &:disabled {
        ${tw`opacity-50 cursor-not-allowed`};
    }

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

const ActionContainer = styled.div`
    ${tw`flex items-center space-x-2`}
`;

const ServerInfoContainer = styled.div`
    ${tw`flex items-center space-x-4`}
`;

const ServerIcon = styled.div`
    ${tw`flex items-center justify-center w-10 h-10 rounded bg-blue-600 text-white flex-shrink-0`}
`;

const ServerDetails = styled.div`
    ${tw`flex-1 min-w-0`}
`;

const ServerName = styled.h3`
    ${tw`text-lg font-semibold text-neutral-50 truncate mb-1`}
`;

const ServerDescription = styled.p`
    ${tw`text-sm text-neutral-400 line-clamp-2 leading-relaxed`}
`;

const ResourceMetric = styled.div`
    ${tw`flex flex-col items-center space-y-1 p-2 rounded bg-neutral-600 min-w-[80px]`}
`;

const MetricHeader = styled.div`
    ${tw`flex items-center space-x-2`}
`;

const MetricValue = styled.span<{ $alarm?: boolean }>`
    ${tw`text-sm font-medium`}
    ${(props) => (props.$alarm ? tw`text-red-400` : tw`text-neutral-50`)}
`;

const MetricLimit = styled.span`
    ${tw`text-xs text-neutral-400`}
`;

type Timer = ReturnType<typeof setInterval>;

export default ({ server, className }: { server: GroupedServer; className?: string }) => {
    const interval = useRef<Timer>(null) as React.MutableRefObject<Timer>;
    const [isSuspended, setIsSuspended] = useState(server.status === 'suspended');
    const [stats, setStats] = useState<ServerStats | null>(null);
    const [isPerformingAction, setIsPerformingAction] = useState(false);

    const handlePowerAction = async (action: PowerAction, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isPerformingAction) return;

        setIsPerformingAction(true);
        try {
            await sendPowerAction(server.uuid, action);
            console.log(`Successfully ${action}ed server ${server.name}`);
        } catch (error) {
            console.error(`Failed to ${action} server:`, httpErrorToHuman(error));
        } finally {
            setIsPerformingAction(false);
        }
    };

    const getStats = () =>
        getServerResourceUsage(server.uuid)
            .then((data) => setStats(data))
            .catch((error) => console.error(error));

    useEffect(() => {
        setIsSuspended(stats?.isSuspended || server.status === 'suspended');
    }, [stats?.isSuspended, server.status]);

    useEffect(() => {
        // Don't waste a HTTP request if there is nothing important to show to the user because
        // the server is suspended.
        if (isSuspended) return;

        getStats().then(() => {
            interval.current = setInterval(() => getStats(), 30000);
        });

        return () => {
            interval.current && clearInterval(interval.current);
        };
    }, [isSuspended]);

    const alarms = { cpu: false, memory: false, disk: false };
    if (stats) {
        alarms.cpu = server.limits.cpu === 0 ? false : stats.cpuUsagePercent >= server.limits.cpu * 0.9;
        alarms.memory = isAlarmState(stats.memoryUsageInBytes, server.limits.memory);
        alarms.disk = server.limits.disk === 0 ? false : isAlarmState(stats.diskUsageInBytes, server.limits.disk);
    }

    const diskLimit = server.limits.disk !== 0 ? bytesToString(mbToBytes(server.limits.disk)) : '无限制';
    const memoryLimit = server.limits.memory !== 0 ? bytesToString(mbToBytes(server.limits.memory)) : '无限制';
    const cpuLimit = server.limits.cpu !== 0 ? server.limits.cpu + ' %' : '无限制';

    return (
        <StatusIndicatorBox as={Link} to={`/server/${server.id}`} className={className} $status={stats?.status}>
            <div className='status-bar' />
            <div css={tw`lg:col-span-2 order-1`}>
                <ServerInfoContainer>
                    <ServerIcon>
                        <FontAwesomeIcon icon={faServer} />
                    </ServerIcon>
                    <ServerDetails>
                        <ServerName>{server.parsedInfo?.displayName || server.name}</ServerName>
                        {!!server.description && <ServerDescription>{server.description}</ServerDescription>}
                    </ServerDetails>
                </ServerInfoContainer>
            </div>
            <div css={tw`lg:col-span-3 order-3 lg:order-2 hidden lg:flex items-center justify-center`}>
                <div css={tw`flex items-center space-x-2 p-2 rounded bg-neutral-600 text-sm`}>
                    <FontAwesomeIcon icon={faEthernet} css={tw`text-blue-400`} />
                    <span css={tw`text-neutral-100 font-medium`}>
                        {server.allocations
                            .filter((alloc) => alloc.isDefault)
                            .map((allocation) => (
                                <React.Fragment key={allocation.ip + allocation.port.toString()}>
                                    {allocation.alias || ip(allocation.ip)}:{allocation.port}
                                </React.Fragment>
                            ))}
                    </span>
                </div>
            </div>
            <div css={tw`lg:col-span-4 order-2 lg:order-3 flex items-center justify-center space-x-3`}>
                {!stats || isSuspended ? (
                    isSuspended ? (
                        <div css={tw`flex-1 text-center`}>
                            <span css={tw`bg-red-600 rounded px-3 py-1.5 text-red-50 text-sm font-medium`}>
                                {server.status === 'suspended' ? '已冻结' : '连接错误'}
                            </span>
                        </div>
                    ) : server.isTransferring || server.status ? (
                        <div css={tw`flex-1 text-center`}>
                            <span css={tw`bg-neutral-600 rounded px-3 py-1.5 text-neutral-100 text-sm font-medium`}>
                                {server.isTransferring
                                    ? '转移中'
                                    : server.status === 'installing'
                                    ? '安装中'
                                    : server.status === 'restoring_backup'
                                    ? '正在回档'
                                    : '不可用'}
                            </span>
                        </div>
                    ) : (
                        <div css={tw`flex items-center space-x-2`}>
                            <Spinner size={'small'} />
                            <span css={tw`text-sm text-neutral-400`}>加载中...</span>
                        </div>
                    )
                ) : (
                    <React.Fragment>
                        <ResourceMetric>
                            <MetricHeader>
                                <Icon icon={faMicrochip} $alarm={alarms.cpu} />
                                <MetricValue $alarm={alarms.cpu}>{stats.cpuUsagePercent.toFixed(1)}%</MetricValue>
                            </MetricHeader>
                            <MetricLimit>/ {cpuLimit}</MetricLimit>
                        </ResourceMetric>
                        <ResourceMetric>
                            <MetricHeader>
                                <Icon icon={faMemory} $alarm={alarms.memory} />
                                <MetricValue $alarm={alarms.memory}>
                                    {bytesToString(stats.memoryUsageInBytes)}
                                </MetricValue>
                            </MetricHeader>
                            <MetricLimit>/ {memoryLimit}</MetricLimit>
                        </ResourceMetric>
                        <ResourceMetric>
                            <MetricHeader>
                                <Icon icon={faHdd} $alarm={alarms.disk} />
                                <MetricValue $alarm={alarms.disk}>{bytesToString(stats.diskUsageInBytes)}</MetricValue>
                            </MetricHeader>
                            <MetricLimit>/ {diskLimit}</MetricLimit>
                        </ResourceMetric>
                    </React.Fragment>
                )}
            </div>
            <div css={tw`lg:col-span-3 order-4 flex items-center justify-center lg:justify-end`}>
                <ActionContainer>
                    <ActionButton
                        variant='start'
                        onClick={(e) => handlePowerAction('start', e)}
                        disabled={isPerformingAction || stats?.status === 'running'}
                        title='启动服务器'
                    >
                        {isPerformingAction ? (
                            <Spinner size='small' />
                        ) : (
                            <>
                                <PlayIcon className='w-4 h-4' />
                                <span>启动</span>
                            </>
                        )}
                    </ActionButton>
                    <ActionButton
                        variant='stop'
                        onClick={(e) => handlePowerAction('stop', e)}
                        disabled={isPerformingAction || stats?.status === 'offline'}
                        title='停止服务器'
                    >
                        {isPerformingAction ? (
                            <Spinner size='small' />
                        ) : (
                            <>
                                <StopIcon className='w-4 h-4' />
                                <span>停止</span>
                            </>
                        )}
                    </ActionButton>
                    <ActionButton
                        variant='restart'
                        onClick={(e) => handlePowerAction('restart', e)}
                        disabled={isPerformingAction}
                        title='重启服务器'
                    >
                        {isPerformingAction ? (
                            <Spinner size='small' />
                        ) : (
                            <>
                                <RefreshIcon className='w-4 h-4' />
                                <span>重启</span>
                            </>
                        )}
                    </ActionButton>
                </ActionContainer>
            </div>
        </StatusIndicatorBox>
    );
};
