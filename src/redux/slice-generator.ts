import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { EndpointConfig, EndpointState, RequestOptions, ApiConfig } from '../core/types';
import { executeRequest } from '../core/fetch';
import { getProvidersByTag } from '../core/registry';

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
    initialState[key as EndpointName] = {
      data: null,
      loading: false,
      error: null,
    };
  });

  const thunks: Record<string, any> = {};
  const reducers: Record<string, (state: any, action: PayloadAction<any>) => void> = {};

  Object.entries(endpoints).forEach(([endpointName, config]) => {
    const thunk = createAsyncThunk(
      `${name}/${endpointName}`,
      async (options: RequestOptions | undefined, { getState, dispatch, rejectWithValue }) => {
        // Staletime Check
        if (!options?.forceRefetch && config.staleTime !== undefined) {
          const state = getState() as any;
          const endpointState = state[name]?.[endpointName] as EndpointState;
          if (endpointState?.data && endpointState.lastFetched) {
            const isFresh = Date.now() - endpointState.lastFetched < config.staleTime;
            if (isFresh) return endpointState.data;
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

          return result;
        } catch (error: any) {
          return rejectWithValue(error.message || 'Request failed');
        }
      }
    );

    thunks[endpointName] = thunk;

    reducers[`${endpointName}Reset`] = (state) => {
      state[endpointName as EndpointName] = {
        data: null,
        loading: false,
        error: null,
      };
    };
  });

  // Global manual update reducer
  reducers['updateData'] = (state, action) => {
    const { endpointName, data } = action.payload;
    if (state[endpointName]) {
      state[endpointName].data = data;
      state[endpointName].lastFetched = Date.now();
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
          .addCase(thunk.pending, (state: any) => {
            state[endpointName].loading = true;
            state[endpointName].error = null;
          })
          .addCase(thunk.fulfilled, (state: any, action) => {
            state[endpointName].loading = false;

            if (config.merge && state[endpointName].data) {
              state[endpointName].data = config.merge(
                state[endpointName].data,
                action.payload,
                action.meta.arg || {}
              );
            } else {
              state[endpointName].data = action.payload;
            }

            state[endpointName].lastFetched = Date.now();
          })
          .addCase(thunk.rejected, (state: any, action) => {
            state[endpointName].loading = false;
            state[endpointName].error =
              action.payload || action.error.message || 'Unknown error';
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
