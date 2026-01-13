import type { EndpointConfig, Tag, RequestOptions } from './types';

interface EndpointOptions<TResponse = any, TBody = any> {
  providesTags?: Tag[];
  invalidatesTags?: Tag[];
  staleTime?: number;
  type?: 'query' | 'mutation';
  transformResponse?: (response: any) => TResponse | Promise<TResponse>;
  onQueryStarted?: (
    arg: RequestOptions<TBody> | undefined,
    api: {
      dispatch: any;
      getState: any;
      queryFulfilled: Promise<TResponse>;
    }
  ) => Promise<void> | void;
  merge?: (currentCacheData: TResponse, responseData: TResponse, arg: RequestOptions<TBody>) => TResponse;
}

export const endpoint = {
  get: <TResponse = unknown>(path: string, options?: EndpointOptions<TResponse, any>): EndpointConfig<TResponse, any> => ({
    method: 'GET',
    path,
    ...options,
  }),

  post: <TResponse = unknown, TBody = unknown>(
    path: string,
    options?: EndpointOptions<TResponse, TBody>
  ): EndpointConfig<TResponse, TBody> => ({
    method: 'POST',
    path,
    ...options,
  }),

  put: <TResponse = unknown, TBody = unknown>(
    path: string,
    options?: EndpointOptions<TResponse, TBody>
  ): EndpointConfig<TResponse, TBody> => ({
    method: 'PUT',
    path,
    ...options,
  }),

  patch: <TResponse = unknown, TBody = unknown>(
    path: string,
    options?: EndpointOptions<TResponse, TBody>
  ): EndpointConfig<TResponse, TBody> => ({
    method: 'PATCH',
    path,
    ...options,
  }),

  delete: <TResponse = unknown>(path: string, options?: EndpointOptions<TResponse, any>): EndpointConfig<TResponse, any> => ({
    method: 'DELETE',
    path,
    ...options,
  }),
};
