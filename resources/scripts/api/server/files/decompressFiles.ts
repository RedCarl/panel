import http from '@/api/http';

export default async (uuid: string, directory: string, file: string): Promise<void> => {
    await http.post(
        `/api/client/servers/${uuid}/files/decompress`,
        { root: directory, file },
        {
            timeout: 10000,
            timeoutErrorMessage: '解压这个压缩包需要较长时间，一旦完成，您将能够看到解压后的文件。',
        },
    );
};
