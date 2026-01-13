import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { defineApi, endpoint, registerStore } from '../src';

describe('Redux integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as Response);
  });

  it('throws error when store is not registered', async () => {
    const api = defineApi({
      name: 'test',
      baseUrl: '/api',
      endpoints: {
        getData: endpoint.get<string>('/data'),
      },
    });

    await expect(api.getData()).rejects.toThrow('Store not registered');
  });

  it('works after store is registered', async () => {
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

    const result = await api.getData();
    expect(result).toEqual(mockData);
  });

  it('dispatches action automatically and updates state', async () => {
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

    expect(store.getState().test.getData.loading).toBe(false);
    expect(store.getState().test.getData.data).toBe(null);

    const promise = api.getData();
    expect(store.getState().test.getData.loading).toBe(true);

    await promise;
    expect(store.getState().test.getData.loading).toBe(false);
    expect(store.getState().test.getData.data).toEqual(mockData);
  });

  it('handles error state correctly', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error')
    );

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

    await expect(api.getData()).rejects.toThrow('Network error');
    expect(store.getState().test.getData.loading).toBe(false);
    expect(store.getState().test.getData.error).toBeTruthy();
  });

  it('sends GET request correctly', async () => {
    const mockData = { id: 1 };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
      headers: new Headers({ 'content-type': 'application/json' }),
    } as Response);

    const api = defineApi({
      name: 'test',
      baseUrl: 'https://api.example.com',
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

    await api.getData();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.example.com/data',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('sends POST request with body', async () => {
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

    await api.createData({ body: requestBody });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/data',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('appends URL params correctly', async () => {
    const mockData = { id: 1 };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
      headers: new Headers({ 'content-type': 'application/json' }),
    } as Response);

    const api = defineApi({
      name: 'test',
      baseUrl: 'https://api.example.com',
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

    await api.getData({ params: { page: 1, limit: 10 } });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.example.com/data?page=1&limit=10',
      expect.any(Object)
    );
  });

  it('substitutes path parameters correctly', async () => {
    const mockData = { id: 123 };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
      headers: new Headers({ 'content-type': 'application/json' }),
    } as Response);

    const api = defineApi({
      name: 'test',
      baseUrl: 'https://api.example.com',
      endpoints: {
        getUser: endpoint.get<typeof mockData>('/users/:id'),
      },
    });

    const store = configureStore({
      reducer: {
        test: api.slice.reducer,
      },
    });

    registerStore(store);

    await api.getUser({ params: { id: 123, extra: 'foo' } });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.example.com/users/123?extra=foo',
      expect.any(Object)
    );
  });
});
