import http from '@/api/http';
import { GroupedServer } from '@/lib/serverGrouping';

export type PowerAction = 'start' | 'stop' | 'restart' | 'kill';

/**
 * Send a power action to a single server
 */
export const sendPowerAction = (serverUuid: string, action: PowerAction): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${serverUuid}/power`, { signal: action })
            .then(() => resolve())
            .catch(reject);
    });
};

/**
 * Send power actions to multiple servers in parallel
 */
export const sendBulkPowerAction = async (
    servers: GroupedServer[],
    action: PowerAction
): Promise<{
    successful: string[];
    failed: { uuid: string; error: string }[];
}> => {
    const results = await Promise.all(
        servers.map((server) =>
            sendPowerAction(server.uuid, action)
                .then(() => ({ uuid: server.uuid, success: true as const }))
                .catch((error) => ({
                    uuid: server.uuid,
                    success: false as const,
                    error: error.message || 'Unknown error',
                }))
        )
    );

    const successful: string[] = [];
    const failed: { uuid: string; error: string }[] = [];

    results.forEach((result) => {
        if (result.success) {
            successful.push(result.uuid);
        } else {
            failed.push({ uuid: result.uuid, error: (result as any).error });
        }
    });

    return { successful, failed };
};