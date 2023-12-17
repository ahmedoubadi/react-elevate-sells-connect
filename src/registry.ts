import { RequestOptions } from 'types';

export interface Shims {
  kind: string;
  fetch: any;
  Request: any;
  Response: any;
  Headers: any;
  FormData: any;
  Blob: any;
  File: any;
  ReadableStream: any;
  getMultipartRequestOptions: <T extends {} = Record<string, unknown>>(
    form: Shims['FormData'],
    opts: RequestOptions<T>
  ) => Promise<RequestOptions<T>>;
  getDefaultAgent: (url: string) => any;
  fileFromPath:
    | ((
        path: string,
        filename?: string,
        options?: {}
      ) => Promise<Shims['File']>)
    | ((path: string, options?: {}) => Promise<Shims['File']>);
  isFsReadStream: (value: any) => boolean;
}
export const kind: Shims['kind'] | undefined = undefined;
