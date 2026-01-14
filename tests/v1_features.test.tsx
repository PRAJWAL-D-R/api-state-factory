import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { defineApi, endpoint, createApiStore, setGlobalConfig } from '../src';

describe('V1.0 Roadmap Features', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({}),
            headers: new Headers({ 'content-type': 'application/json' }),
        } as Response);
    });

    describe('createApiStore', () => {
        it('simplifies store setup', () => {
            const userApi = defineApi({
                name: 'user',
                baseUrl: '/user',
                endpoints: { getUser: 'GET /me' },
            });
            const expenseApi = defineApi({
                name: 'expense',
                baseUrl: '/expense',
                endpoints: { getExpenses: 'GET /all' },
            });

            const store = createApiStore({ apis: [userApi, expenseApi] });

            expect(store.getState()).toHaveProperty('user');
            expect(store.getState()).toHaveProperty('expense');
        });
    });

    describe('Automatic Revalidation (invalidates)', () => {
        it('automatically refetches invalidated endpoints', async () => {
            const api = defineApi({
                name: 'test',
                baseUrl: '/api',
                endpoints: {
                    getExpenses: endpoint.get('/expenses'),
                    deleteExpense: endpoint.delete('/expenses/:id', {
                        invalidates: ['getExpenses'],
                    }),
                },
            });

            const store = createApiStore({ apis: [api] });

            // Initial fetch happens on hook mount if not skipped
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <Provider store={store as any}>{children}</Provider>
            );

            renderHook(() => api.useGetExpenses(), { wrapper });

            await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));

            // Now call delete
            await api.deleteExpense(1);

            // Should have been called twice now: 1 for initial, 1 for delete, 1 for revalidation of getExpenses
            // Wait, deleteExpense call itself is +1
            // Revalidation is +1
            // Total 3
            await waitFor(() => {
                expect(globalThis.fetch).toHaveBeenCalledTimes(3);
            });

            const calls = (globalThis.fetch as any).mock.calls;
            expect(calls[0][0]).toBe('/api/expenses');
            expect(calls[1][0]).toBe('/api/expenses/1');
            expect(calls[2][0]).toBe('/api/expenses');
        });
    });

    describe('Reactive Hooks', () => {
        it('auto-executes when params change', async () => {
            const api = defineApi({
                name: 'test',
                baseUrl: '/api',
                endpoints: {
                    getExpense: 'GET /expenses/:id'
                }
            });

            const store = createApiStore({ apis: [api] });
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <Provider store={store as any}>{children}</Provider>
            );

            const { rerender } = renderHook(({ id }) => api.useGetExpense({ params: { id } }), {
                wrapper,
                initialProps: { id: 1 }
            });

            await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
            expect((globalThis.fetch as any).mock.calls[0][0]).toBe('/api/expenses/1');

            // Change param
            rerender({ id: 2 });

            await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
            expect((globalThis.fetch as any).mock.calls[1][0]).toBe('/api/expenses/2');
        });
    });

    describe('Global Config', () => {
        it('supports global headers callback', async () => {
            setGlobalConfig({
                headers: () => ({ Authorization: 'Bearer token123' })
            });

            const api = defineApi({
                name: 'test',
                baseUrl: '/api',
                endpoints: { getData: 'GET /data' }
            });

            const store = createApiStore({ apis: [api] });
            await store.dispatch(api.thunks.getData());

            expect(globalThis.fetch).toHaveBeenCalledWith(
                '/api/data',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer token123'
                    })
                })
            );

            const headers = (globalThis.fetch as any).mock.calls[0][1].headers;
            expect(headers['Authorization']).toBe('Bearer token123');
        });

        it('supports global onError callback', async () => {
            const onError = vi.fn();
            setGlobalConfig({ onError });

            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            } as Response);

            const api = defineApi({
                name: 'test',
                baseUrl: '/api',
                endpoints: { getData: 'GET /data' }
            });

            const store = createApiStore({ apis: [api] });

            try {
                await store.dispatch(api.thunks.getData());
            } catch (e) {
                // Ignore
            }

            expect(onError).toHaveBeenCalled();
            expect(onError.mock.calls[0][0].status).toBe(500);
        });
    });

    describe('Instance Config', () => {
        it('supports api.setConfig()', async () => {
            const api = defineApi({
                name: 'test',
                baseUrl: '/api',
                endpoints: { getData: 'GET /data' }
            });

            api.setConfig({
                headers: () => ({ 'X-Custom': 'Value' })
            });

            const store = createApiStore({ apis: [api] });
            await store.dispatch(api.thunks.getData());

            const headers = (globalThis.fetch as any).mock.calls[0][1].headers;
            expect(headers['X-Custom']).toBe('Value');
        });
    });
});
