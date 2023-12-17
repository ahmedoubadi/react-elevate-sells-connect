export type Agent = any;
export type Readable = any;
export type HTTPMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
export type Headers = Record<string, string | null | undefined>;
export type PromiseOrValue<T> = T | Promise<T>;
export type DefaultQuery = Record<string, string | undefined>;
export type RequestOptions<
  Req extends {} = Record<string, unknown> | Readable
> = {
  method?: HTTPMethod;
  path?: string;
  query?: Req | undefined;
  body?: Req | undefined;
  headers?: Headers | undefined;

  maxRetries?: number;
  stream?: boolean | undefined;
  timeout?: number;
  httpAgent?: Agent;
  signal?: AbortSignal | undefined | null;
  idempotencyKey?: string;

  __binaryResponse?: boolean | undefined;
};
export type Fetch = (url: RequestInfo, init?: RequestInit) => Promise<Response>;
export type RequestClient = { fetch: Fetch };
export type FinalRequestOptions<
  Req extends {} = Record<string, unknown> | Readable
> = RequestOptions<Req> & {
  method: HTTPMethod;
  path: string;
};

export type APIResponseProps = {
  response: Response;
  options: FinalRequestOptions;
  controller: AbortController;
};

export type Assistant = {
  pk?: number;
  id?: string;
  user_id?: string;
  app_id?: string;
  name?: string;
  logo?: string;
  color?: string;
  welcome_message?: string;
  instruction?: string;
  created_at?: Date;
};

export type API_RESPONSE = {
  data: any;
  status: {
    timestamp: number;
    error_code: number | null;
    error_message: string | null;
  };
};

export type CHAT = {
  id?: string;
  discussion_id: string;
  user: string;
  assistant: string;
};

export type DISCUSSION = {
  pk?: number;
  id: string;
  title: string;
  assistant_id: string;
  created_at: Date;
};
