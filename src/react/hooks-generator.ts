import { useSelector } from 'react-redux';
import { useCallback, useEffect, useRef } from 'react';

import type { EndpointConfig, RequestOptions, EndpointState } from '../core/types';
import { getStore } from '../redux/store-registry';
import { registerTagProvider, unregisterTagProvider } from '../core/registry';

export function createHooks<TEndpoints extends Record<string, any>>(
  apiName: string,
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

    (hooks as Record<string, (options?: RequestOptions<unknown>) => HookResult<unknown, unknown>>)[hookName] = (options?: RequestOptions<unknown>) => {
      const lastOptions = useRef<RequestOptions<unknown> | undefined>(options);

      // Update lastOptions whenever options change
      useEffect(() => {
        lastOptions.current = options;
      }, [JSON.stringify(options)]);

      const state = useSelector(
        (rootState: Record<string, unknown>) =>
          (rootState[apiName] as Record<string, EndpointState>)?.[endpointName] || {
            data: null,
            loading: false,
            error: null,
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
        const store = getStore();
        const result = await (store as any).dispatch(thunk(mergedOptions));
        if (thunk.rejected.match(result)) {
          throw result.payload || result.error;
        }
        return result.payload;
      }, []);


      // Auto-fetch for queries
      useEffect(() => {
        const isQuery = config.type === 'query' || (!config.type && config.method === 'GET');
        if (isQuery && !options?.skip) {
          execute();
        }
      }, [execute, JSON.stringify(options?.params), options?.skip]);

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

      // Register this endpoint as a provider for tags
      useEffect(() => {
        if (config.providesTags) {
          config.providesTags.forEach((tag: string) => {
            registerTagProvider(tag, apiName, endpointName, () => execute());
          });
        }
        return () => {
          if (config.providesTags) {
            config.providesTags.forEach((tag: string) => {
              unregisterTagProvider(tag, apiName, endpointName);
            });
          }
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
  error: any | null;
  execute: (options?: RequestOptions<TBody>) => Promise<TData>;
}
