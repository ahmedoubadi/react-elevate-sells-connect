import {
  APIResponseProps,
  Agent,
  DefaultQuery,
  Fetch,
  FinalRequestOptions,
  HTTPMethod,
  Headers,
  PromiseOrValue,
  RequestClient,
  RequestOptions,
} from 'types';
import { isMultipartBody } from './uploads';
import { kind } from './registry';
import KeepAliveAgent from 'agentkeepalive';
import {
  AIChatError,
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from 'error';
import { isAbsoluteURL, isEmptyObj, safeJSON, sleep } from 'utils';
import { VERSION } from 'version';
import { Stream } from 'streaming';

const defaultHttpAgent: Agent = new KeepAliveAgent({
  keepAlive: true,
  timeout: 5 * 60 * 1000,
});
const defaultHttpsAgent: Agent = new KeepAliveAgent.HttpsAgent({
  keepAlive: true,
  timeout: 5 * 60 * 1000,
});

export const castToError = (err: any): Error => {
  if (err instanceof Error) return err;
  return new Error(err);
};

const validatePositiveInteger = (name: string, n: unknown): number => {
  if (typeof n !== 'number' || !Number.isInteger(n)) {
    throw new Error(`${name} must be an integer`);
  }
  if (n < 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return n;
};
/**
 * https://stackoverflow.com/a/2117523
 */
const uuid4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export function getDefaultAgent(url: string): Agent {
  return url.startsWith('https') ? defaultHttpsAgent : defaultHttpAgent;
}

async function defaultParseResponse<T>(props: APIResponseProps): Promise<T> {
  const { response } = props;
  if (props.options.stream) {
    console.log(
      'response',
      response.status,
      response.url,
      response.headers,
      response.body
    );

    // Note: there is an invariant here that isn't represented in the type system
    // that if you set `stream: true` the response type must also be `Stream<T>`
    return Stream.fromSSEResponse(response, props.controller) as any;
  }

  // fetch refuses to read the body when the status code is 204.
  if (response.status === 204) {
    return null as T;
  }

  if (props.options.__binaryResponse) {
    return response as unknown as T;
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    const json = await response.json();

    console.log(
      'response',
      response.status,
      response.url,
      response.headers,
      json
    );

    return json as T;
  }

  const text = await response.text();
  console.log(
    'response',
    response.status,
    response.url,
    response.headers,
    text
  );

  // TODO handle blob, arraybuffer, other content types, etc.
  return text as unknown as T;
}

export class APIPromise<T> extends Promise<T> {
  private parsedPromise: Promise<T> | undefined;

  constructor(
    private responsePromise: Promise<APIResponseProps>,
    private parseResponse: (
      props: APIResponseProps
    ) => PromiseOrValue<T> = defaultParseResponse
  ) {
    super((resolve) => {
      // this is maybe a bit weird but this has to be a no-op to not implicitly
      // parse the response body; instead .then, .catch, .finally are overridden
      // to parse the response
      resolve(null as any);
    });
  }

  _thenUnwrap<U>(transform: (data: T) => U): APIPromise<U> {
    return new APIPromise(this.responsePromise, async (props) =>
      transform(await this.parseResponse(props))
    );
  }

  /**
   * Gets the raw `Response` instance instead of parsing the response
   * data.
   *
   * If you want to parse the response body but still get the `Response`
   * instance, you can use {@link withResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` if you can.
   */
  asResponse(): Promise<Response> {
    return this.responsePromise.then((p) => p.response);
  }
  /**
   * Gets the parsed response data and the raw `Response` instance.
   *
   * If you just want to get the raw `Response` instance without parsing it,
   * you can use {@link asResponse()}.
   *
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` if you can.
   */
  async withResponse(): Promise<{ data: T; response: Response }> {
    const [data, response] = await Promise.all([
      this.parse(),
      this.asResponse(),
    ]);
    return { data, response };
  }

  private parse(): Promise<T> {
    if (!this.parsedPromise) {
      this.parsedPromise = this.responsePromise.then(this.parseResponse);
    }
    return this.parsedPromise;
  }

  override then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.parse().then(onfulfilled, onrejected);
  }

  override catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | undefined
      | null
  ): Promise<T | TResult> {
    return this.parse().catch(onrejected);
  }

  override finally(onfinally?: (() => void) | undefined | null): Promise<T> {
    return this.parse().finally(onfinally);
  }
}

export abstract class APIClient {
  baseURL: string;
  maxRetries: number;
  timeout: number;
  httpAgent: Agent | undefined;

  private fetch: Fetch;
  protected idempotencyHeader?: string;

  constructor({
    baseURL,
    maxRetries = 2,
    timeout = 600000, // 10 minutes
    httpAgent,
    fetch: overridenFetch,
  }: {
    baseURL: string;
    maxRetries?: number | undefined;
    timeout: number | undefined;
    httpAgent: Agent | undefined;
    fetch: Fetch | undefined;
  }) {
    this.baseURL = baseURL;
    this.maxRetries = validatePositiveInteger('maxRetries', maxRetries);
    this.timeout = validatePositiveInteger('timeout', timeout);
    this.httpAgent = httpAgent;

    this.fetch = overridenFetch ?? fetch;
  }

  protected authHeaders(opts: FinalRequestOptions): Headers {
    return {};
  }

  /**
   * Override this to add your own default headers, for example:
   *
   *  {
   *    ...super.defaultHeaders(),
   *    Authorization: 'Bearer 123',
   *  }
   */
  protected defaultHeaders(opts: FinalRequestOptions): Headers {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': this.getUserAgent(),
      ...this.authHeaders(opts),
    };
  }

  protected abstract defaultQuery(): DefaultQuery | undefined;

  /**
   * Override this to add your own headers validation:
   */
  protected validateHeaders(headers: Headers, customHeaders: Headers) {}

  protected defaultIdempotencyKey(): string {
    return `stainless-node-retry-${uuid4()}`;
  }

  get<Req extends {}, Rsp>(
    path: string,
    opts?: PromiseOrValue<RequestOptions<Req>>
  ): APIPromise<Rsp> {
    return this.methodRequest('get', path, opts);
  }

  post<Req extends {}, Rsp>(
    path: string,
    opts?: PromiseOrValue<RequestOptions<Req>>
  ): APIPromise<Rsp> {
    return this.methodRequest('post', path, opts);
  }

  patch<Req extends {}, Rsp>(
    path: string,
    opts?: PromiseOrValue<RequestOptions<Req>>
  ): APIPromise<Rsp> {
    return this.methodRequest('patch', path, opts);
  }

  put<Req extends {}, Rsp>(
    path: string,
    opts?: PromiseOrValue<RequestOptions<Req>>
  ): APIPromise<Rsp> {
    return this.methodRequest('put', path, opts);
  }

  delete<Req extends {}, Rsp>(
    path: string,
    opts?: PromiseOrValue<RequestOptions<Req>>
  ): APIPromise<Rsp> {
    return this.methodRequest('delete', path, opts);
  }

  private methodRequest<Req extends {}, Rsp>(
    method: HTTPMethod,
    path: string,
    opts?: PromiseOrValue<RequestOptions<Req>>
  ): APIPromise<Rsp> {
    return this.request(
      Promise.resolve(opts).then((opts) => ({ method, path, ...opts }))
    );
  }

  private calculateContentLength(body: unknown): string | null {
    if (typeof body === 'string') {
      if (typeof Buffer !== 'undefined') {
        return Buffer.byteLength(body, 'utf8').toString();
      }

      if (typeof TextEncoder !== 'undefined') {
        const encoder = new TextEncoder();
        const encoded = encoder.encode(body);
        return encoded.length.toString();
      }
    }

    return null;
  }

  buildRequest<Req extends {}>(
    options: FinalRequestOptions<Req>
  ): { req: RequestInit; url: string; timeout: number } {
    const { method, path, query, headers: headers = {} } = options;

    const body = isMultipartBody(options.body)
      ? options.body.body
      : options.body
      ? JSON.stringify(options.body, null, 2)
      : null;
    const contentLength = this.calculateContentLength(body);

    const url = this.buildURL(path!, query);
    if ('timeout' in options)
      validatePositiveInteger('timeout', options.timeout);
    const timeout = options.timeout ?? this.timeout;
    const httpAgent =
      options.httpAgent ?? this.httpAgent ?? getDefaultAgent(url);
    const minAgentTimeout = timeout + 1000;
    if (
      typeof (httpAgent as any)?.options?.timeout === 'number' &&
      minAgentTimeout > ((httpAgent as any).options.timeout ?? 0)
    ) {
      // Allow any given request to bump our agent active socket timeout.
      // This may seem strange, but leaking active sockets should be rare and not particularly problematic,
      // and without mutating agent we would need to create more of them.
      // This tradeoff optimizes for performance.
      (httpAgent as any).options.timeout = minAgentTimeout;
    }

    if (this.idempotencyHeader && method !== 'get') {
      if (!options.idempotencyKey)
        options.idempotencyKey = this.defaultIdempotencyKey();
      headers[this.idempotencyHeader] = options.idempotencyKey;
    }

    const reqHeaders: Record<string, string> = {
      ...(contentLength && { 'Content-Length': contentLength }),
      ...this.defaultHeaders(options),
      ...headers,
    };
    // let builtin fetch set the Content-Type for multipart bodies
    if (isMultipartBody(options.body) && kind !== 'node') {
      delete reqHeaders['Content-Type'];
    }

    // Strip any headers being explicitly omitted with null
    Object.keys(reqHeaders).forEach(
      (key) => reqHeaders[key] === null && delete reqHeaders[key]
    );

    const req: RequestInit = {
      method,
      ...(body && { body: body as any }),
      headers: reqHeaders,
      ...(httpAgent && { agent: httpAgent }),
      // @ts-ignore node-fetch uses a custom AbortSignal type that is
      // not compatible with standard web types
      signal: options.signal ?? null,
    };

    this.validateHeaders(reqHeaders, headers);

    return { req, url, timeout };
  }

  /**
   * Used as a callback for mutating the given `RequestInit` object.
   *
   * This is useful for cases where you want to add certain headers based off of
   * the request properties, e.g. `method` or `url`.
   */
  protected async prepareRequest(
    request: RequestInit,
    { url, options }: { url: string; options: FinalRequestOptions }
  ): Promise<void> {}

  protected parseHeaders(
    headers: HeadersInit | null | undefined
  ): Record<string, string> {
    return !headers
      ? {}
      : Symbol.iterator in headers
      ? Object.fromEntries(
          Array.from(headers as Iterable<string[]>).map((header) => [...header])
        )
      : { ...headers };
  }

  protected makeStatusError(
    status: number | undefined,
    error: Object | undefined,
    message: string | undefined,
    headers: Headers | undefined
  ) {
    return APIError.generate(status, error, message, headers);
  }

  request<Req extends {}, Rsp>(
    options: PromiseOrValue<FinalRequestOptions<Req>>,
    remainingRetries: number | null = null
  ): APIPromise<Rsp> {
    return new APIPromise(this.makeRequest(options, remainingRetries));
  }

  private async makeRequest(
    optionsInput: PromiseOrValue<FinalRequestOptions>,
    retriesRemaining: number | null
  ): Promise<APIResponseProps> {
    const options = await optionsInput;
    if (retriesRemaining == null) {
      retriesRemaining = options.maxRetries ?? this.maxRetries;
    }

    const { req, url, timeout } = this.buildRequest(options);

    await this.prepareRequest(req, { url, options });

    console.log('request', url, options, req.headers);

    if (options.signal?.aborted) {
      throw new APIUserAbortError();
    }

    const controller = new AbortController();
    const response = await this.fetchWithTimeout(
      url,
      req,
      timeout,
      controller
    ).catch(castToError);

    if (response instanceof Error) {
      if (options.signal?.aborted) {
        throw new APIUserAbortError();
      }
      if (retriesRemaining) {
        return this.retryRequest(options, retriesRemaining);
      }
      if (response.name === 'AbortError') {
        throw new APIConnectionTimeoutError();
      }
      throw new APIConnectionError({ cause: response });
    }

    const responseHeaders = createResponseHeaders(response.headers);

    if (!response.ok) {
      if (retriesRemaining && this.shouldRetry(response)) {
        return this.retryRequest(options, retriesRemaining, responseHeaders);
      }

      const errText = await response
        .text()
        .catch((e) => castToError(e).message);
      const errJSON = safeJSON(errText);
      const errMessage = errJSON ? undefined : errText;

      console.log(
        'response',
        response.status,
        url,
        responseHeaders,
        errMessage
      );

      const err = this.makeStatusError(
        response.status,
        errJSON,
        errMessage,
        responseHeaders
      );
      throw err;
    }

    return { response, options, controller };
  }

  buildURL<Req extends Record<string, unknown>>(
    path: string,
    query: Req | null | undefined
  ): string {
    const url = isAbsoluteURL(path)
      ? new URL(path)
      : new URL(
          this.baseURL +
            (this.baseURL.endsWith('/') && path.startsWith('/')
              ? path.slice(1)
              : path)
        );

    const defaultQuery = this.defaultQuery();
    if (!isEmptyObj(defaultQuery)) {
      query = { ...defaultQuery, ...query } as Req;
    }

    if (query) {
      url.search = this.stringifyQuery(query);
    }

    return url.toString();
  }

  protected stringifyQuery(query: Record<string, unknown>): string {
    return Object.entries(query)
      .filter(([_, value]) => typeof value !== 'undefined')
      .map(([key, value]) => {
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        }
        if (value === null) {
          return `${encodeURIComponent(key)}=`;
        }
        throw new AIChatError(
          `Cannot stringify type ${typeof value}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`
        );
      })
      .join('&');
  }

  async fetchWithTimeout(
    url: RequestInfo,
    init: RequestInit | undefined,
    ms: number,
    controller: AbortController
  ): Promise<Response> {
    const { signal, ...options } = init || {};
    if (signal) signal.addEventListener('abort', () => controller.abort());

    const timeout = setTimeout(() => controller.abort(), ms);

    return (
      this.getRequestClient()
        // use undefined this binding; fetch errors if bound to something else in browser/cloudflare
        .fetch.call(undefined, url, {
          signal: controller.signal as any,
          ...options,
        })
        .finally(() => {
          clearTimeout(timeout);
        })
    );
  }

  protected getRequestClient(): RequestClient {
    return { fetch: this.fetch };
  }

  private shouldRetry(response: Response): boolean {
    // Note this is not a standard header.
    const shouldRetryHeader = response.headers.get('x-should-retry');

    // If the server explicitly says whether or not to retry, obey.
    if (shouldRetryHeader === 'true') return true;
    if (shouldRetryHeader === 'false') return false;

    // Retry on request timeouts.
    if (response.status === 408) return true;

    // Retry on lock timeouts.
    if (response.status === 409) return true;

    // Retry on rate limits.
    if (response.status === 429) return true;

    // Retry internal errors.
    if (response.status >= 500) return true;

    return false;
  }

  private async retryRequest(
    options: FinalRequestOptions,
    retriesRemaining: number,
    responseHeaders?: Headers | undefined
  ): Promise<APIResponseProps> {
    // About the Retry-After header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After
    let timeoutMillis: number | undefined;
    const retryAfterHeader = responseHeaders?.['retry-after'];
    if (retryAfterHeader) {
      const timeoutSeconds = parseInt(retryAfterHeader);
      if (!Number.isNaN(timeoutSeconds)) {
        timeoutMillis = timeoutSeconds * 1000;
      } else {
        timeoutMillis = Date.parse(retryAfterHeader) - Date.now();
      }
    }

    // If the API asks us to wait a certain amount of time (and it's a reasonable amount),
    // just do what it says, but otherwise calculate a default
    if (
      !timeoutMillis ||
      !Number.isInteger(timeoutMillis) ||
      timeoutMillis <= 0 ||
      timeoutMillis > 60 * 1000
    ) {
      const maxRetries = options.maxRetries ?? this.maxRetries;
      timeoutMillis = this.calculateDefaultRetryTimeoutMillis(
        retriesRemaining,
        maxRetries
      );
    }
    await sleep(timeoutMillis);

    return this.makeRequest(options, retriesRemaining - 1);
  }

  private calculateDefaultRetryTimeoutMillis(
    retriesRemaining: number,
    maxRetries: number
  ): number {
    const initialRetryDelay = 0.5;
    const maxRetryDelay = 8.0;

    const numRetries = maxRetries - retriesRemaining;

    // Apply exponential backoff, but not more than the max.
    const sleepSeconds = Math.min(
      initialRetryDelay * Math.pow(2, numRetries),
      maxRetryDelay
    );

    // Apply some jitter, take up to at most 25 percent of the retry time.
    const jitter = 1 - Math.random() * 0.25;

    return sleepSeconds * jitter * 1000;
  }

  private getUserAgent(): string {
    return `${this.constructor.name}/JS ${VERSION}`;
  }
}

export const createResponseHeaders = (
  headers: Awaited<ReturnType<Fetch>>['headers']
): Record<string, string> => {
  return new Proxy(
    Object.fromEntries(
      // @ts-ignore
      headers.entries()
    ),
    {
      get(target, name) {
        const key = name.toString();
        return target[key.toLowerCase()] || target[key];
      },
    }
  );
};
