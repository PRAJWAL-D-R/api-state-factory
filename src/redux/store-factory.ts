import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { registerStore } from './store-registry';

export interface ApiStoreConfig {
    apis: any[];
    middleware?: any[];
    preloadedState?: any;
}

export function createApiStore(config: ApiStoreConfig) {
    const reducers: Record<string, any> = {};

    config.apis.forEach((api) => {
        if (api.slice && api.slice.name && api.slice.reducer) {
            reducers[api.slice.name] = api.slice.reducer;
        }
    });

    const rootReducer = combineReducers(reducers);

    const store = configureStore({
        reducer: rootReducer,
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware({
                serializableCheck: false,
            }).concat(config.middleware || []),
        preloadedState: config.preloadedState,
    });

    registerStore(store);
    return store;
}
