import {
  Agent,
  DefaultQuery,
  Fetch,
  FinalRequestOptions,
  Headers,
} from 'types';
import * as Core from './core';
import * as Errors from './error';
export interface ClientOptions {
  /**
   * Defaults to process.env['API_KEY'].
   */
  apiKey?: string;

  /**
   * Defaults to process.env['ASSISTANT_ID'].
   */
  assistantId?: string | null;

  /**
   * Override the default base URL for the API, e.g., "https://api.example.com/v2/"
   */
  baseURL?: string;

  /**
   * The maximum amount of time (in milliseconds) that the client should wait for a response
   * from the server before timing out a single request.
   *
   * Note that request timeouts are retried by default, so in a worst-case scenario you may wait
   * much longer than this timeout before the promise succeeds or fails.
   */
  timeout?: number;

  /**
   * An HTTP agent used to manage HTTP(S) connections.
   *
   * If not provided, an agent will be constructed by default in the Node.js environment,
   * otherwise no agent is used.
   */
  httpAgent?: Agent;

  /**
   * Specify a custom `fetch` function implementation.
   *
   * If not provided, we use `node-fetch` on Node.js and otherwise expect that `fetch` is
   * defined globally.
   */
  fetch?: Fetch | undefined;

  /**
   * The maximum number of times that the client will retry a request in case of a
   * temporary failure, like a network error or a 5XX error from the server.
   *
   * @default 2
   */
  maxRetries?: number;

  /**
   * Default headers to include with every request to the API.
   *
   * These can be removed in individual requests by explicitly setting the
   * header to `undefined` or `null` in request options.
   */
  defaultHeaders?: Headers;

  /**
   * Default query parameters to include with every request to the API.
   *
   * These can be removed in individual requests by explicitly setting the
   * param to `undefined` in request options.
   */
  defaultQuery?: DefaultQuery;

  /**
   * By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   * Only set this option to `true` if you understand the risks and have appropriate mitigations in place.
   */
  dangerouslyAllowBrowser?: boolean;
}

/** API Client for interfacing with the Client API. */
export class Client extends Core.APIClient {
  apiKey: string;
  assistantId: string | null;

  private _options: ClientOptions;

  /**
   * API Client for interfacing with the Client API.
   *
   * @param {string} [opts.apiKey==process.env['API_KEY'] ?? undefined]
   * @param {string | null} [opts.assistantId=="process.env['ASSISTANT_ID']" ?? null]
   * @param {string} [opts.baseURL] - Override the default base URL for the API.
   * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {number} [opts.httpAgent] - An HTTP agent used to manage HTTP(s) connections.
   * @param {Core.Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {Core.Headers} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Core.DefaultQuery} opts.defaultQuery - Default query parameters to include with every request to the API.
   * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   */
  constructor({ apiKey = '', assistantId = '', ...opts }: ClientOptions = {}) {
    if (apiKey === undefined) {
      throw new Errors.AIChatError(
        "The AI Chat Assistant api key variable is missing or empty; either provide it, or instantiate the client with an apiKey option, like new Client({ apiKey: 'My API Key' })."
      );
    }

    const options: ClientOptions = {
      apiKey,
      assistantId,
      ...opts,
      baseURL: opts.baseURL ?? `https://ai.fastlybot.com/v1`,
    };

    super({
      baseURL: options.baseURL!,
      timeout: options.timeout ?? 600000 /* 10 minutes */,
      httpAgent: options.httpAgent,
      maxRetries: options.maxRetries,
      fetch: options.fetch,
    });
    this._options = options;

    this.apiKey = apiKey;
    this.assistantId = assistantId;
  }

  protected override defaultQuery(): DefaultQuery | undefined {
    return this._options.defaultQuery;
  }

  protected override defaultHeaders(opts: FinalRequestOptions): Headers {
    return {
      ...super.defaultHeaders(opts),
      ...this._options.defaultHeaders,
    };
  }

  protected override authHeaders(opts: FinalRequestOptions): Headers {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  static Client = this;

  static AIChatError = Errors.AIChatError;
  static APIError = Errors.APIError;
  static APIConnectionError = Errors.APIConnectionError;
  static APIConnectionTimeoutError = Errors.APIConnectionTimeoutError;
  static APIUserAbortError = Errors.APIUserAbortError;
  static NotFoundError = Errors.NotFoundError;
  static ConflictError = Errors.ConflictError;
  static RateLimitError = Errors.RateLimitError;
  static BadRequestError = Errors.BadRequestError;
  static AuthenticationError = Errors.AuthenticationError;
  static InternalServerError = Errors.InternalServerError;
  static PermissionDeniedError = Errors.PermissionDeniedError;
  static UnprocessableEntityError = Errors.UnprocessableEntityError;
}
