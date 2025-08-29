import React, { useEffect } from 'react';
import { default as Dropdown } from '@/components/elements/dropdown/Dropdown';
import { ChevronDownIcon } from '@heroicons/react/solid';
import { ServerIcon } from '@heroicons/react/outline';
import classNames from 'classnames';
import tw from 'twin.macro';
import styled from 'styled-components/macro';
import { PowerAction } from '@/api/server/power';

interface Props {
    domains: string[];
    selectedDomain: string;
    onDomainChange: (domain: string) => void;
    onBulkAction?: (action: PowerAction) => Promise<void>;
    serverCount?: number;
    className?: string;
}

const Container = styled.div`
    ${tw`flex items-center justify-between bg-neutral-700 rounded-lg p-4 mb-6`}
`;

const SelectorContainer = styled.div`
    ${tw`flex items-center space-x-4`}
`;

const ServerCount = styled.span`
    ${tw`text-sm text-neutral-400 flex items-center space-x-1`}
`;

// Cookie操作函数
const DOMAIN_COOKIE_KEY = 'pterodactyl_selected_domain';

const setCookie = (name: string, value: string, days = 30) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

const getCookie = (name: string): string | null => {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
};

const DomainSelector: React.FC<Props> = ({
    domains,
    selectedDomain,
    onDomainChange,
    onBulkAction: _onBulkAction,
    serverCount = 0,
    className,
}) => {
    // 初始化时从cookie读取选择的域
    useEffect(() => {
        const savedDomain = getCookie(DOMAIN_COOKIE_KEY);
        if (savedDomain && domains.includes(savedDomain) && savedDomain !== selectedDomain) {
            onDomainChange(savedDomain);
        }
    }, [domains]);

    // 当域选择改变时保存到cookie
    const handleDomainChange = (domain: string) => {
        setCookie(DOMAIN_COOKIE_KEY, domain);
        onDomainChange(domain);
    };

    return (
        <Container className={className}>
            <SelectorContainer>
                <Dropdown>
                    <Dropdown.Button className='bg-neutral-600 hover:bg-neutral-500 text-neutral-200 px-4 py-2 rounded flex items-center space-x-2'>
                        <ServerIcon className='w-4 h-4' />
                        <span>域: {selectedDomain}</span>
                        <ChevronDownIcon className='w-4 h-4' />
                    </Dropdown.Button>
                    {domains.map((domain) => (
                        <Dropdown.Item
                            key={domain}
                            onClick={() => handleDomainChange(domain)}
                            className={classNames({
                                'bg-neutral-600': domain === selectedDomain,
                            })}
                        >
                            {domain}
                        </Dropdown.Item>
                    ))}
                </Dropdown>
                <ServerCount>
                    <ServerIcon className='w-4 h-4' />
                    <span>{serverCount} 台服务器</span>
                </ServerCount>
            </SelectorContainer>

            {/* {onBulkAction && (
                <ActionContainer>
                    <ActionButton variant='start' onClick={() => handleBulkAction('start')} title='启动所有服务器'>
                        <PlayIcon className='w-4 h-4' />
                        <span>启动</span>
                    </ActionButton>
                    <ActionButton variant='stop' onClick={() => handleBulkAction('stop')} title='停止所有服务器'>
                        <StopIcon className='w-4 h-4' />
                        <span>停止</span>
                    </ActionButton>
                    <ActionButton variant='restart' onClick={() => handleBulkAction('restart')} title='重启所有服务器'>
                        <RefreshIcon className='w-4 h-4' />
                        <span>重启</span>
                    </ActionButton>
                </ActionContainer>
            )} */}
        </Container>
    );
};

export default DomainSelector;
