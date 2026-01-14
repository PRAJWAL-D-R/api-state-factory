import { useSelector } from 'react-redux';
import { useCallback, useEffect, useRef, useMemo } from 'react';

import type { EndpointConfig, RequestOptions, EndpointState } from '../core/types';
import { getStore } from '../redux/store-registry';
import { registerTagProvider, unregisterTagProvider } from '../core/registry';
import { generateCacheKey } from '../core/util';

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

    (hooks as Record<string, (options?: RequestOptions<unknown>) => HookResult<unknown, unknown>>)[hookName] = (options?: any) => {
      const normalizedOptions = useMemo(() => {
        if (typeof options === 'string' || typeof options === 'number') {
          const match = config.path.match(/:([a-zA-Z0-9_]+)/);
          if (match) {
            return { params: { [match[1]]: options } } as RequestOptions<any>;
          }
        }
        return (options || {}) as RequestOptions<any>;
      }, [JSON.stringify(options)]);

      const lastOptions = useRef<RequestOptions<unknown>>(normalizedOptions);

      const cacheKey = useMemo(() =>
        normalizedOptions?.cacheKey || generateCacheKey(baseUrl, config.path, config.method, normalizedOptions)
        , [normalizedOptions]);

      // Update lastOptions whenever options change
      useEffect(() => {
        lastOptions.current = normalizedOptions;
      }, [normalizedOptions]);

      const state = useSelector(
        (rootState: Record<string, unknown>) => {
          const endpointState = (rootState[apiName] as Record<string, EndpointState>)?.[endpointName];
          return endpointState?.[cacheKey] || {
            data: null,
            loading: false,
            isRefreshing: false,
            error: null,
          };
        }
      );

      const execute = useCallback(async (arg?: any) => {
        let execOptions = typeof arg === 'object' && arg !== null ? arg : {};

        // Smart Argument Parsing for Hooks
        if (typeof arg === 'string' || typeof arg === 'number') {
          const match = config.path.match(/:([a-zA-Z0-9_]+)/);
          if (match) {
            execOptions = { params: { [match[1]]: arg } };
          }
        }

        // Merge mount-time options with execution-time options
        const mergedOptions = { ...lastOptions.current, ...execOptions };

        // If merge strategy is enabled, we stay in the same slot
        if (config.merge && !mergedOptions.cacheKey) {
          mergedOptions.cacheKey = cacheKey;
        }

        const store = getStore();
        const result = await (store as any).dispatch(thunk(mergedOptions));
        if (thunk.rejected.match(result)) {
          throw result.payload || result.error;
        }
        return result.payload;
      }, [cacheKey]);


      // Auto-fetch for queries
      useEffect(() => {
        const isQuery = config.type === 'query' || (!config.type && config.method === 'GET');
        if (isQuery && !normalizedOptions?.skip) {
          execute();
        }
      }, [execute, JSON.stringify(normalizedOptions?.params), normalizedOptions?.skip]);

      // Polling
      useEffect(() => {
        if (options?.pollingInterval && options.pollingInterval > 0 && !options.skip) {
          const interval = setInterval(() => {
            execute({ forceRefetch: true });
          }, options.pollingInterval);
          return () => clearInterval(interval);
        }
        return undefined;
      }, [execute, options?.pollingInterval, options?.skip]);

      // Register this endpoint as a provider for tags AND its own endpoint name
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
        ...state,
        execute,
      };
    };
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
