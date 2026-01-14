import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { EndpointConfig, EndpointState, RequestOptions, ApiConfig } from '../core/types';
import { executeRequest } from '../core/fetch';
import { getProvidersByTag } from '../core/registry';
import { generateCacheKey } from '../core/util';

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

        // Staletime Check (Slot-based)
        if (!options?.forceRefetch && config.staleTime !== undefined) {
          const state = getState() as any;
          const slot = state[name]?.[endpointName]?.[cacheKey];
          if (slot?.data && slot.lastFetched) {
            const isFresh = Date.now() - slot.lastFetched < config.staleTime;
            if (isFresh) return { result: slot.data, cacheKey };
          }
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

          // Phase 2: Tag Invalidation Logic
          if (config.invalidatesTags && config.invalidatesTags.length > 0) {
            config.invalidatesTags.forEach((tag: string) => {
              const providers = getProvidersByTag(tag);
              providers.forEach((provider) => {
                provider.trigger();
              });
            });
          }

          // Phase 5: Automatic Endpoint Revalidation (invalidates)
          if (config.invalidates && config.invalidates.length > 0) {
            config.invalidates.forEach((targetEndpoint: string) => {
              // 1. Clear the cache for the target endpoint (all slots)
              dispatch({ type: `${name}/${targetEndpoint}Reset` });

              // 2. Trigger re-fetch for active listeners (hooks)
              const providers = getProvidersByTag(`__endpoint__:${targetEndpoint}`);
              providers.forEach((provider) => {
                provider.trigger();
              });
            });
          }

          return { result, cacheKey };
        } catch (error: any) {
          return rejectWithValue({ error: error.message || 'Request failed', cacheKey });
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
            if (!state[endpointName][cacheKey]) {
              state[endpointName][cacheKey] = {
                data: null,
                loading: true,
                isRefreshing: true,
                error: null,
              };
            } else {
              state[endpointName][cacheKey].loading = false;
              state[endpointName][cacheKey].isRefreshing = true;
              state[endpointName][cacheKey].error = null;
            }
          })
          .addCase(thunk.fulfilled, (state: any, action) => {
            const { result, cacheKey } = action.payload as { result: any; cacheKey: string };
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
            const { error, cacheKey } = (action.payload as any) || { error: action.error.message, cacheKey: generateCacheKey(baseUrl, config.path, config.method, action.meta.arg) };
            const slot = state[endpointName][cacheKey];
            if (slot) {
              slot.loading = false;
              slot.isRefreshing = false;
              slot.error = error || 'Unknown error';
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
