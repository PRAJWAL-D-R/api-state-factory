import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { EndpointConfig, EndpointState, RequestOptions, ApiConfig } from '../core/types';
import { executeRequest } from '../core/fetch';
import { getGlobalConfig } from '../core/config';
import { getProvidersByTag } from '../core/registry';
import { generateCacheKey } from '../core/util';

function serializePrimitiveError(error: unknown) {
  if (typeof error === 'string') return { message: error };
  if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') return { message: String(error) };
  return { message: 'Request failed' };
}

function serializeObjectError(anyErr: any) {
  if (typeof anyErr?.message !== 'string') return { message: 'Request failed' };
  return {
    message: anyErr.message,
    name: typeof anyErr.name === 'string' ? anyErr.name : undefined,
    status: typeof anyErr.status === 'number' ? anyErr.status : undefined,
    statusText: typeof anyErr.statusText === 'string' ? anyErr.statusText : undefined,
    url: typeof anyErr.url === 'string' ? anyErr.url : undefined,
    body: anyErr.body,
  };
}

function defaultSerializeError(error: unknown) {
  if (error && typeof error === 'object') return serializeObjectError(error as any);
  return serializePrimitiveError(error);
}

function getFreshSlotData(
  state: any,
  apiName: string,
  endpointName: string,
  cacheKey: string,
  staleTime: number
) {
  const slot = state?.[apiName]?.[endpointName]?.[cacheKey];
  if (!slot?.data || !slot.lastFetched) return undefined;
  const isFresh = Date.now() - slot.lastFetched < staleTime;
  return isFresh ? slot.data : undefined;
}

function triggerInvalidatedTags(invalidatesTags: string[] | undefined) {
  if (!invalidatesTags?.length) return;
  invalidatesTags.forEach((tag) => {
    const providers = getProvidersByTag(tag);
    providers.forEach((provider) => provider.trigger());
  });
}

function revalidateEndpoints(
  dispatch: any,
  apiName: string,
  invalidates: string[] | undefined
) {
  if (!invalidates?.length) return;
  invalidates.forEach((targetEndpoint) => {
    dispatch({ type: `${apiName}/${targetEndpoint}Reset` });
    const providers = getProvidersByTag(`__endpoint__:${targetEndpoint}`);
    providers.forEach((provider) => provider.trigger());
  });
}

export function createEndpointSlice<TEndpoints extends Record<string, any>>(
  name: string,
  baseUrl: string,
  endpoints: TEndpoints,
  apiInstanceConfig?: ApiConfig
) {
  type EndpointName = keyof TEndpoints;
  type EndpointStates = {
    [K in EndpointName]: EndpointState<
      TEndpoints[K] extends EndpointConfig<infer TResponse> ? TResponse : unknown
    >;
  };

  const initialState: EndpointStates = {} as EndpointStates;

  Object.keys(endpoints).forEach((key) => {
    initialState[key as EndpointName] = {} as any;
  });

  const thunks: Record<string, any> = {};
  const reducers: Record<string, (state: any, action: PayloadAction<any>) => void> = {};

  Object.entries(endpoints).forEach(([endpointName, config]) => {
    const thunk = createAsyncThunk(
      `${name}/${endpointName}`,
      async (options: RequestOptions | undefined, { getState, dispatch, rejectWithValue }) => {
        const cacheKey = options?.cacheKey || generateCacheKey(baseUrl, config.path, config.method, options);

        if (!options?.forceRefetch && config.staleTime !== undefined) {
          const state = getState() as any;
          const fresh = getFreshSlotData(state, name, endpointName, cacheKey, config.staleTime);
          if (fresh !== undefined) return { result: fresh, cacheKey };
        }

        try {
          const promise = executeRequest(baseUrl, config, options, apiInstanceConfig, { getState, dispatch });

          // Phase 3: Optimistic Updates (onQueryStarted)
          if (config.onQueryStarted) {
            config.onQueryStarted(options, {
              dispatch,
              getState, // exposed from createAsyncThunk
              queryFulfilled: promise
            });
          }

          let result = await promise;

          // Phase 4: Transform Response
          if (config.transformResponse) {
            result = await config.transformResponse(result);
          }

          triggerInvalidatedTags(config.invalidatesTags);
          revalidateEndpoints(dispatch, name, config.invalidates);

          return { result, cacheKey };
        } catch (error: any) {
          const globalConfig = getGlobalConfig();
          const serializer = apiInstanceConfig?.serializeError || globalConfig.serializeError || defaultSerializeError;
          const serialized = serializer(error);
          return rejectWithValue({ error: serialized, cacheKey });
        }
      }
    );

    thunks[endpointName] = thunk;

    reducers[`${endpointName}Reset`] = (state) => {
      state[endpointName as EndpointName] = {};
    };
  });

  reducers['reset'] = (state) => {
    Object.keys(endpoints).forEach((key) => {
      state[key] = {};
    });
  };

  reducers['updateData'] = (state, action) => {
    const { endpointName, data, params } = action.payload;
    const config = endpoints[endpointName];
    if (config && state[endpointName]) {
      const cacheKey = generateCacheKey(baseUrl, config.path, config.method, { params });
      state[endpointName][cacheKey] = {
        data,
        loading: false,
        isRefreshing: false,
        error: null,
        lastFetched: Date.now(),
      };
    }
  };

  const slice = createSlice({
    name,
    initialState,
    reducers,
    extraReducers: (builder) => {
      Object.entries(thunks).forEach(([endpointName, thunk]) => {
        const config = endpoints[endpointName];
        builder
          .addCase(thunk.pending, (state: any, action) => {
            const cacheKey = action.meta.arg?.cacheKey || generateCacheKey(baseUrl, config.path, config.method, action.meta.arg);
            const existing = state[endpointName][cacheKey];
            if (existing) {
              const hasData = existing.data !== null && existing.data !== undefined;
              if (hasData) {
                existing.loading = false;
                existing.isRefreshing = true;
              } else {
                existing.loading = true;
                existing.isRefreshing = false;
              }
              existing.error = null;
            } else {
              state[endpointName][cacheKey] = {
                data: null,
                loading: true,
                isRefreshing: true,
                error: null,
              };
            }
          })
          .addCase(thunk.fulfilled, (state: any, action) => {
            const payload: any = action.payload;
            const result = payload.result;
            const cacheKey = payload.cacheKey as string;
            const slot = state[endpointName][cacheKey];

            slot.loading = false;
            slot.isRefreshing = false;

            if (typeof config.merge === 'function' && slot.data) {
              slot.data = config.merge(slot.data, result, action.meta.arg || {});
            } else if (config.merge === true && Array.isArray(slot.data) && Array.isArray(result)) {
              slot.data = [...slot.data, ...result];
            } else {
              slot.data = result;
            }

            slot.lastFetched = Date.now();
          })
          .addCase(thunk.rejected, (state: any, action) => {
            const fallbackCacheKey = generateCacheKey(baseUrl, config.path, config.method, action.meta.arg);
            const payload: any = action.payload;
            const cacheKey = payload?.cacheKey ?? fallbackCacheKey;
            const error = payload?.error ?? (action.error || { message: action.error.message });
            const slot = state[endpointName][cacheKey];
            if (slot) {
              slot.loading = false;
              slot.isRefreshing = false;
              slot.error = error || { message: 'Unknown error' };
            }
          });
      });
    },
  });

  return {
    slice,
    thunks,
    actions: slice.actions,
  };
}
