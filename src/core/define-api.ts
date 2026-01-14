import type { EndpointConfig, RequestOptions, ApiConfig, EndpointDefinition } from './types';
import { createEndpointSlice } from '../redux/slice-generator';
import { getStore } from '../redux/store-registry';
import { createHooks } from '../react/hooks-generator';

export interface ApiDefinition<TEndpoints extends Record<string, any>> {
  name: string;
  baseUrl: string;
  endpoints: TEndpoints;
  config?: ApiConfig;
}

import { endpoint } from './endpoint';

export function defineApi<
  Map extends Record<string, { response?: any; body?: any; query?: any; params?: any }> | unknown = unknown,
  TEndpoints extends Record<string, EndpointDefinition<any, any>> = Record<string, EndpointDefinition<any, any>>
>(
  definition: ApiDefinition<TEndpoints>
) {
  const normalizedEndpoints: Record<string, EndpointConfig<any, any>> = {};
  const instanceConfig: ApiConfig = { ...definition.config };

  Object.entries(definition.endpoints).forEach(([key, value]) => {
    if (typeof value === 'string') {
      const parts = value.split(' ');
      if (parts.length === 2) {
        const [method, path] = parts;
        if (method.toUpperCase() === 'GET') {
          normalizedEndpoints[key] = endpoint.get(path);
        } else {
          normalizedEndpoints[key] = {
            method: method as any,
            path,
            type: 'mutation',
          };
        }
      } else {
        // '/url' format -> Default to GET
        normalizedEndpoints[key] = endpoint.get(value);
      }
    } else if (typeof value === 'object' && 'url' in value) {
      // Hybrid Definition { url: 'GET /path', ... }
      const [method, path] = (value as any).url.split(' ');
      normalizedEndpoints[key] = {
        method: method as any,
        path,
        type: method === 'GET' ? 'query' : 'mutation',
        ...value,
      };
    } else {
      normalizedEndpoints[key] = value as EndpointConfig<any, any>;
    }
  });

  const { slice, thunks, actions } = createEndpointSlice(
    definition.name,
    definition.baseUrl,
    normalizedEndpoints,
    instanceConfig
  );

  type EndpointNames = Map extends Record<string, any> ? keyof Map : keyof TEndpoints;

  // Helpers to resolve types
  type ResolveResponse<K extends EndpointNames> = Map extends Record<string, any>
    ? (K extends keyof Map ? Map[K]['response'] : unknown)
    : (K extends keyof TEndpoints ? (TEndpoints[K] extends EndpointConfig<infer R, any> ? R : unknown) : unknown);

  type ResolveBody<K extends EndpointNames> = Map extends Record<string, any>
    ? (K extends keyof Map ? Map[K]['body'] : unknown)
    : (K extends keyof TEndpoints ? (TEndpoints[K] extends EndpointConfig<any, infer B> ? B : unknown) : unknown);

  // Smart Argument Type Logic
  // If Map defines params with 1 key, or inferred path has :param, we could allow primitive. 
  // For simplicity keeping strict RequestOptions OR primitive for :id.

  type DirectCallMethods = {
    [K in EndpointNames]: (
      arg?: RequestOptions<ResolveBody<K>> | string | number
    ) => Promise<ResolveResponse<K>>;
  };

  const directCalls: DirectCallMethods = {} as DirectCallMethods;

  Object.entries(thunks).forEach(([endpointName, thunk]) => {
    (directCalls as Record<string, unknown>)[endpointName] = async (
      arg: any
    ) => {
      const store = getStore();
      const config = normalizedEndpoints[endpointName];
      let options: RequestOptions<any> | undefined = typeof arg === 'object' && arg !== null ? arg : {};

      // Smart Argument Parsing
      // If arg is primitive (string/number), map it to the first param in path
      if (typeof arg === 'string' || typeof arg === 'number') {
        const match = config.path.match(/:([a-zA-Z0-9_]+)/);
        if (match) {
          options = { params: { [match[1]]: arg } };
        }
      }

      const result = await (store as any).dispatch(thunk(options));
      if (thunk.rejected.match(result)) {
        throw (result.payload as any)?.error || result.error;
      }
      return (result.payload as any)?.result ?? result.payload;
    };
  });

  // We need to support the generic Map in createHooks too, but for now passing normalizedEndpoints
  // createHooks might need update to support the Map generic if we want Hooks to be typed by Map.
  // Casting to any to avoid complex TS issues for now, relying on the return type inference.
  const hooks = createHooks(definition.name, definition.baseUrl, normalizedEndpoints as any, thunks) as any;

  return {
    slice,
    actions,
    setConfig: (newConfig: ApiConfig) => {
      Object.assign(instanceConfig, newConfig);
    },
    thunks,
    ...directCalls,
    ...hooks,
  } as {
    slice: typeof slice;
    actions: typeof actions;
    setConfig: (newConfig: ApiConfig) => void;
    thunks: Record<EndpointNames, any>;
  } & DirectCallMethods & {
      // Re-type hooks
      [K in EndpointNames as `use${Capitalize<string & K>}`]: (
        arg?: RequestOptions<ResolveBody<K>> | string | number
      ) => { data: ResolveResponse<K> | null; loading: boolean; error: any; execute: (opt?: any) => Promise<ResolveResponse<K>> }
    };
}
