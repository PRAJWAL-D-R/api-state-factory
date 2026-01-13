import { Tag } from './types';

// Registry for in-flight requests to enable deduplication
const inFlightRequests = new Map<string, Promise<any>>();

export const getInFlightRequest = (key: string) => inFlightRequests.get(key);
export const setInFlightRequest = (key: string, promise: Promise<any>) => inFlightRequests.set(key, promise);
export const deleteInFlightRequest = (key: string) => inFlightRequests.delete(key);

// Registry for tag-to-endpoint mappings to enable automated refetching
// Maps Tag -> Set of endpoint trigger functions
const tagRegistry = new Map<Tag, Set<{ apiName: string; endpointName: string; trigger: (options?: any) => Promise<any> }>>();

export const registerTagProvider = (tag: Tag, apiName: string, endpointName: string, trigger: (options?: any) => Promise<any>) => {
    if (!tagRegistry.has(tag)) {
        tagRegistry.set(tag, new Set());
    }
    const providers = tagRegistry.get(tag)!;

    // Replace existing provider for this api/endpoint if it exists
    const existing = Array.from(providers).find(p => p.apiName === apiName && p.endpointName === endpointName);
    if (existing) {
        providers.delete(existing);
    }

    providers.add({ apiName, endpointName, trigger });
};

export const unregisterTagProvider = (tag: Tag, apiName: string, endpointName: string) => {
    const providers = tagRegistry.get(tag);
    if (providers) {
        const existing = Array.from(providers).find(p => p.apiName === apiName && p.endpointName === endpointName);
        if (existing) {
            providers.delete(existing);
        }
    }
};

export const getProvidersByTag = (tag: Tag) => {
    return tagRegistry.get(tag) || new Set();
};
