import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { defineApi, endpoint, createApiStore } from '../src';

describe('V1.0 Advanced Features', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ id: 1, name: 'Item 1' }),
            headers: new Headers({ 'content-type': 'application/json' }),
        } as Response);
    });

    describe('Parameterized Caching (Multi-Slot Storage)', () => {
        it('should store different data for different params', async () => {
            const api = defineApi({
                name: 'test',
                baseUrl: '/api',
                endpoints: { getItem: 'GET /item/:id' }
            });

            const store = createApiStore({ apis: [api] });
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <Provider store={store as any}>{children}</Provider>
            );

            // Fetch id: 1
            const { rerender, result } = renderHook(({ id }) => api.useGetItem(id), {
                wrapper,
                initialProps: { id: 1 }
            });

            await waitFor(() => expect(result.current.data).toEqual({ id: 1, name: 'Item 1' }));

            // Fetch id: 2
            (globalThis.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 2, name: 'Item 2' }),
                headers: new Headers({ 'content-type': 'application/json' }),
            });

            rerender({ id: 2 });
            await waitFor(() => expect(result.current.data).toEqual({ id: 2, name: 'Item 2' }));

            // Switch back to id: 1 - should be instant from cache
            rerender({ id: 1 });
            expect(result.current.data).toEqual({ id: 1, name: 'Item 1' });
        });
    });

    describe('Smooth UX: isRefreshing vs loading', () => {
        it('should handle loading and isRefreshing correctly', async () => {
            let resolveFetch: (v: any) => void;
            const fetchPromise = new Promise(r => { resolveFetch = r; });
            (globalThis.fetch as any).mockReturnValueOnce(fetchPromise);

            const api = defineApi({
                name: 'test',
                baseUrl: '/api',
                endpoints: { getData: 'GET /data' }
            });

            const store = createApiStore({ apis: [api] });
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <Provider store={store as any}>{children}</Provider>
            );

            const { result } = renderHook(() => api.useGetData(), { wrapper });

            // Virgin fetch: both true
            expect(result.current.loading).toBe(true);
            expect(result.current.isRefreshing).toBe(true);

            resolveFetch!({
                ok: true,
                json: async () => ({ data: 'foo' }),
                headers: new Headers({ 'content-type': 'application/json' }),
            });

            await waitFor(() => expect(result.current.loading).toBe(false));
            expect(result.current.data).toEqual({ data: 'foo' });

            // Refresh: loading stays false, isRefreshing becomes true
            const fetchPromise2 = new Promise(r => { resolveFetch = r; });
            (globalThis.fetch as any).mockReturnValueOnce(fetchPromise2);

            result.current.execute({ forceRefetch: true });

            await waitFor(() => expect(result.current.isRefreshing).toBe(true));
            expect(result.current.loading).toBe(false);
            expect(result.current.data).toEqual({ data: 'foo' }); // Old data still there

            resolveFetch!({
                ok: true,
                json: async () => ({ data: 'bar' }),
                headers: new Headers({ 'content-type': 'application/json' }),
            });

            await waitFor(() => expect(result.current.isRefreshing).toBe(false));
            expect(result.current.data).toEqual({ data: 'bar' });
        });
    });

    describe('Infinite Scroll: List Merging', () => {
        it('should merge results when merge: true', async () => {
            const api = defineApi({
                name: 'test',
                baseUrl: '/api',
                endpoints: {
                    getPosts: endpoint.get('/posts', { merge: true })
                }
            });

            const store = createApiStore({ apis: [api] });
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <Provider store={store as any}>{children}</Provider>
            );

            (globalThis.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => [1, 2],
                headers: new Headers({ 'content-type': 'application/json' }),
            });

            const { result } = renderHook(() => api.useGetPosts(), { wrapper });
            await waitFor(() => expect(result.current.data).toEqual([1, 2]));

            (globalThis.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => [3, 4],
                headers: new Headers({ 'content-type': 'application/json' }),
            });

            await result.current.execute({ params: { page: 2 } });
            expect(result.current.data).toEqual([1, 2, 3, 4]);
        });
    });

    describe('Global Reset', () => {
        it('should clear state on reset()', async () => {
            const api = defineApi({
                name: 'test',
                baseUrl: '/api',
                endpoints: { getData: 'GET /data' }
            });

            const store = createApiStore({ apis: [api] });
            await store.dispatch(api.thunks.getData());

            const cacheKey = Object.keys(store.getState().test.getData)[0];
            expect(store.getState().test.getData[cacheKey].data).toBeTruthy();

            store.dispatch(api.actions.reset());
            expect(store.getState().test.getData).toEqual({});
        });
    });

    describe('Automatic Retry', () => {
        it('should retry failed requests', async () => {
            vi.useFakeTimers();

            const api = defineApi({
                name: 'test',
                baseUrl: '/api',
                endpoints: {
                    getData: endpoint.get('/data', { retry: 2 })
                }
            });

            const store = createApiStore({ apis: [api] });

            // Fail twice, succeed third time
            (globalThis.fetch as any)
                .mockRejectedValueOnce(new Error('Fail 1'))
                .mockRejectedValueOnce(new Error('Fail 2'))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ success: true }),
                    headers: new Headers({ 'content-type': 'application/json' }),
                });

            const promise = store.dispatch(api.thunks.getData());

            // Wait for first fail
            await vi.advanceTimersByTimeAsync(100);
            // Should be waiting for retry 1
            await vi.advanceTimersByTimeAsync(1000);
            // Wait for second fail
            await vi.advanceTimersByTimeAsync(100);
            // Should be waiting for retry 2
            await vi.advanceTimersByTimeAsync(1000);

            const result = await promise;
            expect(result.payload.result).toEqual({ success: true });
            expect(globalThis.fetch).toHaveBeenCalledTimes(3);

            vi.useRealTimers();
        });
    });
});
