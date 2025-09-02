import { FileObject } from '@/api/server/files/loadDirectory';
import http from '@/api/http';
import { rawDataToFileObject } from '@/api/transformers';

export default async (uuid: string, directory: string, files: string[]): Promise<FileObject> => {
    const { data } = await http.post(
        `/api/client/servers/${uuid}/files/compress`,
        { root: directory, files },
        {
            timeout: 60000,
            timeoutErrorMessage: '打包成压缩包可能需要一些时间，一旦完成，您将能够看到生成的压缩文件。',
        },
    );

    return rawDataToFileObject(data);
};
