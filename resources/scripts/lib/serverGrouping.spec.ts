import { Server } from '@/api/server/getServer';
import { parseServerName, groupServersByDomain, getDomainList, getSortedGroupTree } from '@/lib/serverGrouping';

function mockServer(name: string, uuid = 'uuid-1'): Server {
    return {
        id: 'id-1',
        identifier: 'abc123de' as Server['identifier'],
        internalId: 1,
        __deprecatedUuidShort: 'abc123de',
        uuid,
        name,
        node: 'node-1',
        isNodeUnderMaintenance: false,
        status: null,
        sftpDetails: { ip: '127.0.0.1', port: 2022 },
        invocation: '',
        dockerImage: '',
        description: '',
        limits: { memory: 1024, swap: 0, disk: 1024, io: 500, cpu: 100, threads: null },
        eggFeatures: [],
        featureLimits: { databases: 0, allocations: 1, backups: 0 },
        isTransferring: false,
        variables: [],
        allocations: [],
    };
}

describe('@/lib/serverGrouping.ts', function () {
    describe('parseServerName()', function () {
        it('should fall back to default domain for plain names without #', function () {
            const result = parseServerName('SURVIVAL');

            expect(result.domain).toBe('default');
            expect(result.groups).toEqual([]);
            expect(result.displayName).toBe('SURVIVAL');
            expect(result.originalName).toBe('SURVIVAL');
        });

        it('should parse domain and groups with priorities', function () {
            const result = parseServerName('example.com#web[1]:frontend[2]');

            expect(result.domain).toBe('example.com');
            expect(result.groups).toEqual([
                { name: 'web', priority: 1, level: 1 },
                { name: 'frontend', priority: 2, level: 2 },
            ]);
            expect(result.displayName).toBe('frontend');
            expect(result.sequence).toBe('2');
        });

        it('should default missing priority to 999', function () {
            const result = parseServerName('a.com#group');

            expect(result.groups).toEqual([{ name: 'group', priority: 999, level: 1 }]);
            expect(result.displayName).toBe('group');
        });
    });

    describe('groupServersByDomain()', function () {
        it('should put ungrouped servers into default domain groupTree so they are visible', function () {
            const servers = [mockServer('SURVIVAL', 'uuid-survival')];
            const groups = groupServersByDomain(servers);

            expect(getDomainList(groups)).toEqual(['default']);

            const domain = groups.get('default')!;
            expect(domain.servers).toHaveLength(1);
            expect(domain.groupTree.size).toBe(1);
            expect(domain.groupTree.has('SURVIVAL')).toBe(true);

            const leaf = domain.groupTree.get('SURVIVAL')!;
            expect(leaf.servers).toHaveLength(1);
            expect(leaf.servers[0].uuid).toBe('uuid-survival');
            expect(leaf.children.size).toBe(0);
        });

        it('should keep valid grouped names under their domain tree', function () {
            const servers = [mockServer('a.com#web[1]:app[2]', 'uuid-app')];
            const groups = groupServersByDomain(servers);

            expect(groups.has('a.com')).toBe(true);
            expect(groups.has('default')).toBe(false);

            const tree = getSortedGroupTree(groups, 'a.com')!;
            expect(tree.has('web')).toBe(true);

            const web = tree.get('web')!;
            expect(web.children.has('app')).toBe(true);
            expect(web.children.get('app')!.servers[0].uuid).toBe('uuid-app');
        });

        it('should mix ungrouped and grouped servers correctly', function () {
            const servers = [
                mockServer('SURVIVAL', 'uuid-1'),
                mockServer('game.io#SURVIVAL[1]:main[1]', 'uuid-2'),
            ];
            const groups = groupServersByDomain(servers);

            expect(getDomainList(groups)).toEqual(['default', 'game.io']);
            expect(groups.get('default')!.groupTree.get('SURVIVAL')!.servers).toHaveLength(1);
            expect(groups.get('game.io')!.groupTree.get('SURVIVAL')!.children.get('main')!.servers).toHaveLength(1);
        });
    });
});
