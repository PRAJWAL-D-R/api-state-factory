import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { defineApi, endpoint, registerStore } from '../src';

describe('Pagination & Merge', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        globalThis.fetch = vi.fn();
    });

    it('should merge paginated data', async () => {
        const page1 = { items: [1, 2], nextPage: 2 };
        const page2 = { items: [3, 4], nextPage: 3 };

        let callCount = 0;
        (globalThis.fetch as any).mockImplementation(() => {
            callCount++;
            return Promise.resolve({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve(callCount === 1 ? page1 : page2),
            });
        });

        const api = defineApi({
            name: 'paginationApi',
            baseUrl: 'http://api.com',
            endpoints: {
                getList: endpoint.get<{ items: number[]; nextPage: number }>('/list', {
                    merge: (currentCache, newResponse) => {
                        return {
                            items: [...currentCache.items, ...newResponse.items],
                            nextPage: newResponse.nextPage,
                        };
                    }
                }),
            },
        });

        const store = configureStore({
            reducer: { [api.slice.name]: api.slice.reducer }
        });
        registerStore(store);

        // Fetch page 1
        await api.getList({ params: { page: 1 }, cacheKey: 'list' });
        const state = () => store.getState().paginationApi.getList['list'];
        expect(state().data).toEqual(page1);

        // Fetch page 2
        await api.getList({ params: { page: 2 }, forceRefetch: true, cacheKey: 'list' });

        // Should be merged
        expect(state().data).toEqual({
            items: [1, 2, 3, 4],
            nextPage: 3
        });
    });
});
