import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { setGlobalConfig } from '../src/core/config';
import { executeRequest } from '../src/core/fetch';
import { defineApi, endpoint, registerStore } from '../src';

describe('Enterprise Features - Interceptors, Deduplication & Tags', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        globalThis.fetch = vi.fn();
        setGlobalConfig({ interceptors: {} });
    });

    it('should call global onRequest interceptor', async () => {
        const onRequest = vi.fn((options) => {
            options.headers = { ...options.headers, 'X-Test': 'true' };
            return options;
        });
        setGlobalConfig({ interceptors: { onRequest } });

        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'application/json']]),
            json: () => Promise.resolve({ success: true }),
        } as Response);

        await executeRequest('http://api.com', { method: 'GET', path: '/test' });

        expect(onRequest).toHaveBeenCalled();
        const fetchCall = (globalThis.fetch as any).mock.calls[0];
        expect(fetchCall[1].headers['X-Test']).toBe('true');
    });

    it('should deduplicate simultaneous requests', async () => {
        let callCount = 0;
        (globalThis.fetch as any).mockImplementation(() => {
            callCount++;
            return new Promise((resolve) =>
                setTimeout(() => resolve({
                    ok: true,
                    headers: new Map([['content-type', 'application/json']]),
                    json: () => Promise.resolve({ data: 'ok' }),
                }), 50)
            );
        });

        const req1 = executeRequest('http://api.com', { method: 'GET', path: '/dedupe' });
        const req2 = executeRequest('http://api.com', { method: 'GET', path: '/dedupe' });

        const [res1, res2] = await Promise.all([req1, req2]);

        expect(callCount).toBe(1);
        expect(res1).toEqual({ data: 'ok' });
        expect(res2).toEqual({ data: 'ok' });
    });

    it('should call onResponseError on failed request', async () => {
        const onResponseError = vi.fn();
        setGlobalConfig({ interceptors: { onResponseError } });

        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
        } as Response);

        await expect(executeRequest('http://api.com', { method: 'GET', path: '/fail' }))
            .rejects.toThrow('HTTP 401');

        expect(onResponseError).toHaveBeenCalled();
    });

    it('should trigger refetch when a tag is invalidated', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'application/json']]),
            json: () => Promise.resolve({ success: true }),
        } as Response);

        const api = defineApi({
            name: 'tagApi',
            baseUrl: 'http://api.com',
            endpoints: {
                getData: endpoint.get('/data', { providesTags: ['Item'] }),
                updateData: endpoint.post<any, any>('/data', { invalidatesTags: ['Item'] }),
            },
        });

        const store = configureStore({
            reducer: { [api.slice.name]: api.slice.reducer }
        });
        registerStore(store);

        const { registerTagProvider } = await import('../src/core/registry');
        const mockTrigger = vi.fn().mockResolvedValue({ success: true });
        registerTagProvider('Item', 'tagApi', 'getData', mockTrigger);

        await api.updateData({ body: {} });

        expect(mockTrigger).toHaveBeenCalled();
    });
});
