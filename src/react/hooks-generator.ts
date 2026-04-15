import { useSelector } from 'react-redux';
import { useCallback, useEffect, useRef, useMemo } from 'react';

import type { EndpointConfig, RequestOptions, EndpointState } from '../core/types';
import { getStore } from '../redux/store-registry';
import { registerTagProvider, unregisterTagProvider } from '../core/registry';
import { generateCacheKey } from '../core/util';

const DEFAULT_RESULT_STATE = Object.freeze({
  data: null,
  loading: false,
  isRefreshing: false,
  error: null,
});

const EMPTY_OPTIONS = Object.freeze({}) as RequestOptions<any>;

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === 'object' && typeof (err as any).message === 'string') {
    const e = new Error((err as any).message);
    Object.assign(e, err);
    return e;
  }
  if (typeof err === 'string') return new Error(err);
  if (typeof err === 'number' || typeof err === 'boolean' || typeof err === 'bigint') return new Error(String(err));
  return new Error('Request failed');
}

export function createHooks<TEndpoints extends Record<string, any>>(
  apiName: string,
  baseUrl: string,
  endpoints: TEndpoints,
  thunks: Record<string, any>
) {
  type EndpointName = keyof TEndpoints;
  type HookMethods = {
    [K in EndpointName as `use${Capitalize<string & K>}`]: TEndpoints[K] extends EndpointConfig<infer TResponse, infer TBody>
    ? (options?: RequestOptions<TBody>) => HookResult<TResponse, TBody>
    : TEndpoints[K] extends string
    ? (options?: RequestOptions<unknown>) => HookResult<unknown, unknown>
    : never;
  };

  const hooks = {} as HookMethods;

  Object.entries(endpoints).forEach(([endpointName, config]) => {
    const hookName = `use${capitalizeFirst(endpointName)}` as keyof HookMethods;
    const thunk = thunks[endpointName];

    const useHook = (options?: any): HookResult<any, any> => {
      const normalizedOptions = useMemo(() => {
        if (typeof options === 'string' || typeof options === 'number') {
          const match = config.path.match(/:([a-zA-Z0-9_]+)/);
          if (match) {
            return { params: { [match[1]]: options } } as RequestOptions<any>;
          }
        }
        if (options === undefined || options === null) return EMPTY_OPTIONS;
        return options as RequestOptions<any>;
      }, [options]);

      const lastOptions = useRef<RequestOptions<unknown>>(normalizedOptions);

      const cacheKey = useMemo(
        () => normalizedOptions?.cacheKey || generateCacheKey(baseUrl, config.path, config.method, normalizedOptions),
        [baseUrl, config.method, config.path, normalizedOptions]
      );

      useEffect(() => {
        lastOptions.current = normalizedOptions;
      }, [normalizedOptions]);

      const state = useSelector((rootState: Record<string, unknown>) => {
        const endpointState = (rootState[apiName] as Record<string, EndpointState>)?.[endpointName];
        return endpointState?.[cacheKey] || DEFAULT_RESULT_STATE;
      });

      const execute = useCallback(async (arg?: any) => {
        let execOptions = typeof arg === 'object' && arg !== null ? arg : {};

        if (typeof arg === 'string' || typeof arg === 'number') {
          const match = config.path.match(/:([a-zA-Z0-9_]+)/);
          if (match) {
            execOptions = { params: { [match[1]]: arg } };
          }
        }

        const mergedOptions = { ...lastOptions.current, ...execOptions };

        if (config.merge && !mergedOptions.cacheKey) {
          mergedOptions.cacheKey = cacheKey;
        }

        const store = getStore();
        const result = await (store as any).dispatch(thunk(mergedOptions));
        if (thunk.rejected.match(result)) {
          const payload: any = result.payload;
          throw toError(payload?.error ?? payload ?? result.error);
        }
        const payload: any = result.payload;
        return payload?.result ?? payload;
      }, [cacheKey, thunk]);

      useEffect(() => {
        const isQuery = config.type === 'query' || (!config.type && config.method === 'GET');
        if (isQuery && !normalizedOptions?.skip) {
          execute();
        }
      }, [execute, config.method, config.type, cacheKey, normalizedOptions?.skip]);

      useEffect(() => {
        if (normalizedOptions?.pollingInterval && normalizedOptions.pollingInterval > 0 && !normalizedOptions.skip) {
          const interval = setInterval(() => {
            execute({ forceRefetch: true });
          }, normalizedOptions.pollingInterval);
          return () => clearInterval(interval);
        }
        return undefined;
      }, [execute, normalizedOptions?.pollingInterval, normalizedOptions?.skip]);

      useEffect(() => {
        const tags = [...(config.providesTags || []), `__endpoint__:${endpointName}`];

        tags.forEach((tag: string) => {
          registerTagProvider(tag, apiName, endpointName as string, () => execute({ forceRefetch: true }));
        });

        return () => {
          tags.forEach((tag: string) => {
            unregisterTagProvider(tag, apiName, endpointName as string);
          });
        };
      }, [execute]);

      return {
        ...(state as any),
        execute,
      };
    };

    (hooks as Record<string, (options?: RequestOptions<unknown>) => HookResult<unknown, unknown>>)[hookName] = useHook as any;
  });

  return hooks;
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export interface HookResult<TData, TBody> {
  data: TData | null;
  loading: boolean;
  isRefreshing: boolean;
  error: any | null;
  execute: (options?: RequestOptions<TBody>) => Promise<TData>;
}
