import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { defineApi, endpoint, registerStore } from '../src';

describe('Auto-Fetch & Cache TTL', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        globalThis.fetch = vi.fn();
    });

    it('should considered fresh within staleTime', async () => {
        const mockData = { id: 1 };
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'application/json']]),
            json: () => Promise.resolve(mockData),
        } as unknown as Response);

        const api = defineApi({
            name: 'cacheApi',
            baseUrl: 'http://api.com',
            endpoints: {
                getData: endpoint.get('/data', { staleTime: 1000 }),
            },
        });

        const store = configureStore({
            reducer: { [api.slice.name]: api.slice.reducer }
        });
        registerStore(store);

        // First call
        await api.getData();
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        // Second call within staleTime
        await api.getData();
        expect(globalThis.fetch).toHaveBeenCalledTimes(1); // Should not call fetch again
    });

    it('should refetch after staleTime expires', async () => {
        const mockData = { id: 1 };
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'application/json']]),
            json: () => Promise.resolve(mockData),
        } as unknown as Response);

        const api = defineApi({
            name: 'expireApi',
            baseUrl: 'http://api.com',
            endpoints: {
                getData: endpoint.get('/data', { staleTime: 10 }),
            },
        });

        const store = configureStore({
            reducer: { [api.slice.name]: api.slice.reducer }
        });
        registerStore(store);

        await api.getData();
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        // Wait for staleTime to expire
        await new Promise(resolve => setTimeout(resolve, 20));

        await api.getData();
        expect(globalThis.fetch).toHaveBeenCalledTimes(2); // Should call fetch again
    });

    it('should transform response if transformResponse is provided', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'application/json']]),
            json: () => Promise.resolve({ user_name: 'john_doe' }),
        } as unknown as Response);

        const api = defineApi({
            name: 'transformApi',
            baseUrl: 'http://api.com',
            endpoints: {
                getData: endpoint.get('/data', {
                    transformResponse: (res) => ({ userName: res.user_name }),
                }),
            },
        });

        const store = configureStore({
            reducer: { [api.slice.name]: api.slice.reducer }
        });
        registerStore(store);

        const result = await api.getData();
        expect(result).toEqual({ userName: 'john_doe' });
        expect(store.getState().transformApi.getData.data).toEqual({ userName: 'john_doe' });
    });
});
