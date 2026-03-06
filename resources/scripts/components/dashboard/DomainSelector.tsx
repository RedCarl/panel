import React, { useEffect } from 'react';
import { ServerIcon } from '@heroicons/react/24/outline';
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
    ${tw`flex items-center justify-between bg-gradient-to-r from-neutral-800 to-neutral-700 rounded-xl p-2 mb-3 shadow-lg border border-neutral-600/50`}
    transition: all 0.2s ease-in-out;

    &:hover {
        ${tw`shadow-xl border-neutral-500/70`}
        transform: translateY(-1px);
    }
`;

const LeftContainer = styled.div`
    ${tw`flex items-center space-x-3`}
`;

const RightContainer = styled.div`
    ${tw`flex items-center space-x-3`}
`;

const ServerInfo = styled.div`
    ${tw`flex items-center space-x-2 bg-neutral-600/50 rounded-lg px-3 py-2`}
`;

const DomainLabel = styled.label`
    ${tw`text-neutral-300 text-sm font-medium`}
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

const DomainSelect = styled.select`
    ${tw`bg-neutral-600 hover:bg-neutral-500 text-neutral-100 px-3 py-2 rounded-lg border border-neutral-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition-all duration-200 text-sm`}

    &:hover {
        ${tw`border-neutral-400`}
    }

    option {
        ${tw`bg-neutral-700 text-neutral-100 py-2`}
    }
`;

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
    const handleDomainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const domain = e.target.value;
        setCookie(DOMAIN_COOKIE_KEY, domain);
        onDomainChange(domain);
    };

    return (
        <Container className={className}>
            <LeftContainer>
                <ServerInfo>
                    <ServerIcon className='w-5 h-5 text-blue-400' />
                    <span className='text-neutral-200 text-sm font-medium'>{serverCount} 个服务器</span>
                </ServerInfo>
            </LeftContainer>

            <RightContainer>
                <DomainLabel>域:</DomainLabel>
                <DomainSelect value={selectedDomain} onChange={handleDomainChange}>
                    {domains.map((domain) => (
                        <option key={domain} value={domain}>
                            {domain}
                        </option>
                    ))}
                </DomainSelect>
            </RightContainer>
        </Container>
    );
};

export default DomainSelector;
