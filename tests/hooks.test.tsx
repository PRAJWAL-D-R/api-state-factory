import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { defineApi, endpoint, registerStore } from '../src';

describe('React hooks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as Response);
  });

  it('exposes data, loading, error, and execute', () => {
    const api = defineApi({
      name: 'test',
      baseUrl: '/api',
      endpoints: {
        getData: endpoint.get<string>('/data'),
      },
    });

    const store = configureStore({
      reducer: {
        test: api.slice.reducer,
      },
    });

    registerStore(store);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store as any}>{children}</Provider>
    );

    const { result } = renderHook(() => api.useGetData(), { wrapper });

    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('execute');
    expect(typeof result.current.execute).toBe('function');
  });

  it('does not auto-fetch on mount', async () => {
    const api = defineApi({
      name: 'test',
      baseUrl: '/api',
      endpoints: {
        getData: endpoint.get<string>('/data'),
      },
    });

    const store = configureStore({
      reducer: {
        test: api.slice.reducer,
      },
    });

    registerStore(store);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    renderHook(() => api.useGetData(), { wrapper });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it('should skip auto-fetch when skip: true is provided', async () => {
    const api = defineApi({
      name: 'test',
      baseUrl: '/api',
      endpoints: {
        getData: endpoint.get<string>('/data'),
      },
    });

    const store = configureStore({
      reducer: {
        test: api.slice.reducer,
      },
    });

    registerStore(store);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    renderHook(() => api.useGetData({ skip: true }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('triggers request when execute is called', async () => {
    const mockData = { id: 1, name: 'test' };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
      headers: new Headers({ 'content-type': 'application/json' }),
    } as Response);

    const api = defineApi({
      name: 'test',
      baseUrl: '/api',
      endpoints: {
        getData: endpoint.get<typeof mockData>('/data'),
      },
    });

    const store = configureStore({
      reducer: {
        test: api.slice.reducer,
      },
    });

    registerStore(store);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => api.useGetData({ skip: true }), { wrapper });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);

    result.current.execute();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('updates loading state during request', async () => {
    let resolveFetch: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(fetchPromise);

    const api = defineApi({
      name: 'test',
      baseUrl: '/api',
      endpoints: {
        getData: endpoint.get<string>('/data'),
      },
    });

    const store = configureStore({
      reducer: {
        test: api.slice.reducer,
      },
    });

    registerStore(store);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => api.useGetData({ skip: true }), { wrapper });

    const executePromise = result.current.execute();

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    resolveFetch!({
      ok: true,
      json: async () => ({ data: 'test' }),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as Response);

    await executePromise;

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('handles POST requests with body in execute', async () => {
    const mockResponse = { id: 1, name: 'John' };
    const requestBody = { name: 'John' };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      headers: new Headers({ 'content-type': 'application/json' }),
    } as Response);

    const api = defineApi({
      name: 'test',
      baseUrl: '/api',
      endpoints: {
        createData: endpoint.post<typeof mockResponse, typeof requestBody>('/data'),
      },
    });

    const store = configureStore({
      reducer: {
        test: api.slice.reducer,
      },
    });

    registerStore(store);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => api.useCreateData(), { wrapper });

    await result.current.execute({ body: requestBody });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/data',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(requestBody),
      })
    );
  });
});
