import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { defineApi, registerStore } from '../src';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

describe('Shorthand Endpoints', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ id: 1, name: 'Shorthand' }),
            headers: new Headers({ 'content-type': 'application/json' }),
        } as Response);
    });

    it('should support string shorthand for GET endpoints', async () => {
        const api = defineApi({
            name: 'shorthandApi',
            baseUrl: 'http://api.com',
            endpoints: {
                getSimple: '/simple', // Shorthand
            },
        });

        const store = configureStore({
            reducer: { [api.slice.name]: api.slice.reducer }
        });
        registerStore(store);

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <Provider store={store}>{children}</Provider>
        );

        const { result } = renderHook(() => api.useGetSimple(), { wrapper });

        await waitFor(() => expect(result.current.data).toEqual({ id: 1, name: 'Shorthand' }));

        expect(globalThis.fetch).toHaveBeenCalledWith(
            'http://api.com/simple',
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('should allow direct call on shorthand endpoint', async () => {
        const api = defineApi({
            name: 'shorthandDirect',
            baseUrl: 'http://api.com',
            endpoints: {
                getDirect: '/direct',
            },
        });

        const store = configureStore({
            reducer: { [api.slice.name]: api.slice.reducer }
        });
        registerStore(store);

        const data = await api.getDirect();
        expect(data).toEqual({ id: 1, name: 'Shorthand' });
    });
});
