import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { defineApi, registerStore } from '../src';

describe('v0.3.1 Features & Fixes', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
            headers: new Headers({ 'content-type': 'application/json' }),
        } as Response);
    });

    it('Smart Argument Parsing: should accept primitive ID for direct calls', async () => {
        const api = defineApi({
            name: 'smartArgs',
            baseUrl: 'http://api.com',
            endpoints: {
                deleteUser: 'DELETE /users/:id',
            }
        });

        const store = configureStore({
            reducer: { [api.slice.name]: api.slice.reducer }
        });
        registerStore(store);

        await api.deleteUser(123);

        expect(globalThis.fetch).toHaveBeenCalledWith(
            'http://api.com/users/123',
            expect.objectContaining({ method: 'DELETE' })
        );
    });

    it('Fix: should allow string shorthand explicit GET', async () => {
        const api = defineApi({
            name: 'explicitGet',
            baseUrl: 'http://api.com',
            endpoints: {
                list: 'GET /list',
            }
        });

        const store = configureStore({
            reducer: { [api.slice.name]: api.slice.reducer }
        });
        registerStore(store);

        await api.list();

        expect(globalThis.fetch).toHaveBeenCalledWith(
            'http://api.com/list',
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('Optional Body: should call POST without body if not required', async () => {
        const api = defineApi({
            name: 'optBody',
            baseUrl: 'http://api.com',
            endpoints: {
                ping: 'POST /ping',
            }
        });

        const store = configureStore({
            reducer: { [api.slice.name]: api.slice.reducer }
        });
        registerStore(store);

        await api.ping(); // Should not throw type error in usage, and runtime works

        expect(globalThis.fetch).toHaveBeenCalledWith(
            'http://api.com/ping',
            expect.objectContaining({ method: 'POST' })
        );
    });
});
