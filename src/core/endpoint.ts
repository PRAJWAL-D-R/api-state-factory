import type { EndpointConfig, Tag, RequestOptions } from './types';

interface EndpointOptions<TResponse = any, TBody = any, TKeys extends string = string> {
  providesTags?: Tag[];
  invalidatesTags?: Tag[];
  invalidates?: TKeys[];
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
  get: <TResponse = unknown, TKeys extends string = string>(
    path: string,
    options?: EndpointOptions<TResponse, any, TKeys>
  ): EndpointConfig<TResponse, any, TKeys> => ({
    method: 'GET',
    path,
    ...options,
  }),

  post: <TResponse = unknown, TBody = unknown, TKeys extends string = string>(
    path: string,
    options?: EndpointOptions<TResponse, TBody, TKeys>
  ): EndpointConfig<TResponse, TBody, TKeys> => ({
    method: 'POST',
    path,
    ...options,
  }),

  put: <TResponse = unknown, TBody = unknown, TKeys extends string = string>(
    path: string,
    options?: EndpointOptions<TResponse, TBody, TKeys>
  ): EndpointConfig<TResponse, TBody, TKeys> => ({
    method: 'PUT',
    path,
    ...options,
  }),

  patch: <TResponse = unknown, TBody = unknown, TKeys extends string = string>(
    path: string,
    options?: EndpointOptions<TResponse, TBody, TKeys>
  ): EndpointConfig<TResponse, TBody, TKeys> => ({
    method: 'PATCH',
    path,
    ...options,
  }),

  delete: <TResponse = unknown, TKeys extends string = string>(
    path: string,
    options?: EndpointOptions<TResponse, any, TKeys>
  ): EndpointConfig<TResponse, any, TKeys> => ({
    method: 'DELETE',
    path,
    ...options,
  }),
};