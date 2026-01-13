import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { defineApi, endpoint, registerStore } from '../src';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

describe('Optimistic Updates & Polling', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({}),
            text: async () => '',
            headers: new Headers({ 'content-type': 'application/json' }),
        } as unknown as Response);
    });

    it('should handle optimistic updates via onQueryStarted', async () => {
        let resolveRequest: any;
        const requestPromise = new Promise(resolve => resolveRequest = resolve);

        (globalThis.fetch as any).mockImplementation(() => requestPromise);

        const api = defineApi({
            name: 'optimisticApi',
            baseUrl: 'http://api.com',
            endpoints: {
                getData: endpoint.get('/data'),
                updateData: endpoint.post('/data', {
                    onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
                        // Optimistic update
                        dispatch(api.actions.updateData({ endpointName: 'getData', data: { id: 1, name: 'Optimistic' } }));
                        try {
                            await queryFulfilled;
                        } catch {
                            // Rollback (simplified for test)
                            dispatch(api.actions.updateData({ endpointName: 'getData', data: { id: 1, name: 'Original' } }));
                        }
                    }
                })
            },
        });

        const store = configureStore({
            reducer: { [api.slice.name]: api.slice.reducer }
        });
        registerStore(store);

        // Pre-fill state
        store.dispatch(api.actions.updateData({ endpointName: 'getData', data: { id: 1, name: 'Original' } }));

        // Trigger mutation
        const promise = api.updateData({ body: {} });

        // Check optimistic state
        expect(store.getState().optimisticApi.getData.data).toEqual({ id: 1, name: 'Optimistic' });

        // Resolve request
        resolveRequest({
            ok: true,
            json: async () => ({ success: true }),
            text: async () => '',
            headers: new Map(),
        } as unknown as Response);
        await promise;

        // Should remain optimistic (or be updated by validation, but here we just check it wasn't rolled back)
        expect(store.getState().optimisticApi.getData.data).toEqual({ id: 1, name: 'Optimistic' });
    });

    it.skip('should poll at specified interval', async () => {
        vi.useFakeTimers();
        const api = defineApi({
            name: 'pollingApi',
            baseUrl: 'http://api.com',
            endpoints: {
                getData: endpoint.get('/data'),
            },
        });

        const store = configureStore({
            reducer: { [api.slice.name]: api.slice.reducer }
        });
        registerStore(store);

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <Provider store={store}>{children}</Provider>
        );

        renderHook(() => api.useGetData({ pollingInterval: 1000 }), { wrapper });

        // Initial fetch check
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        // Advance time 1005ms
        await React.act(async () => {
            vi.advanceTimersByTime(1005);
        });

        // Flushing microtasks heavily
        for (let i = 0; i < 10; i++) await Promise.resolve();

        expect(globalThis.fetch).toHaveBeenCalledTimes(2);

        await React.act(async () => {
            vi.advanceTimersByTime(1005);
        });

        for (let i = 0; i < 10; i++) await Promise.resolve();

        expect(globalThis.fetch).toHaveBeenCalledTimes(3);

        vi.useRealTimers();
    });
});
