export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type Tag = string;

export interface RequestInterceptors {
  onRequest?: (options: RequestOptions<any>) => Promise<RequestOptions<any>> | RequestOptions<any>;
  onResponseError?: (error: any) => Promise<void> | void;
}

export interface EndpointConfig<TResponse = unknown, TBody = never, TKeys extends string = string> {
  method: HttpMethod;
  path: string;
  type?: 'query' | 'mutation'; // Defaults to 'query' for GET, 'mutation' for others
  staleTime?: number; // Time in ms before data is considered stale
  providesTags?: Tag[];
  invalidatesTags?: Tag[];
  invalidates?: TKeys[];
  transformResponse?: (response: any) => TResponse | Promise<TResponse>;
  onQueryStarted?: (
    arg: RequestOptions<TBody> | undefined,
    api: {
      dispatch: any;
      getState: any;
      queryFulfilled: Promise<TResponse>;
    }
  ) => Promise<void> | void;
  retry?: number; // Number of retries on failure
  retryDelayMs?: number; // Delay between retries (ms)
  merge?: boolean | ((currentCacheData: TResponse, responseData: TResponse, arg: RequestOptions<TBody>) => TResponse);
}

export interface RequestOptions<TBody = unknown> {
  body?: TBody;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  cacheKey?: string; // Internal use for deduplication
  skip?: boolean; // For hooks: skip auto-fetch
  forceRefetch?: boolean; // Override staleTime
  pollingInterval?: number; // Auto-refetch interval in ms
  signal?: AbortSignal;
}

export interface ApiRequestError {
  message: string;
  status?: number;
  statusText?: string;
  url?: string;
  body?: unknown;
  cause?: unknown;
}

export interface ResultState<TData = unknown> {
  data: TData | null;
  loading: boolean;
  isRefreshing: boolean;
  error: any | null;
  lastFetched?: number;
}

export type EndpointState<TData = unknown> = Record<string, ResultState<TData>>;

export interface ApiConfig {
  interceptors?: RequestInterceptors;
  prepareHeaders?: (headers: Headers, api: { getState: any; endpoint: string }) => Headers | void;
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  onError?: (error: any, api: { dispatch: any; getState: any }) => void;
  /**
   * When running in SSR/Node with a relative baseUrl (e.g. "/api"), provide an absolute origin
   * like "https://example.com" so requests resolve correctly.
   */
  ssrBaseUrl?: string;
  /**
   * Customize how errors are stored in Redux (must be serializable).
   */
  serializeError?: (error: unknown) => any;
}

export type EndpointDefinition<TResponse = unknown, TBody = unknown, TKeys extends string = string> =
  | string
  | EndpointConfig<TResponse, TBody, TKeys>
  | ({ url: string } & Omit<EndpointConfig<TResponse, TBody, TKeys>, 'method' | 'path'>);

