import type { ApiConfig } from './types';

let globalConfig: ApiConfig = {
    interceptors: {},
};

export const setGlobalConfig = (config: ApiConfig) => {
    globalConfig = {
        ...globalConfig,
        ...config,
        interceptors: {
            ...globalConfig.interceptors,
            ...config.interceptors,
        },
    };
};

export const getGlobalConfig = () => globalConfig;
