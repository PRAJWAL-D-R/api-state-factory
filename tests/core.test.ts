import { describe, it, expect } from 'vitest';
import { defineApi, endpoint } from '../src';

describe('defineApi', () => {
  it('returns slice with reducer', () => {
    const api = defineApi({
      name: 'test',
      baseUrl: '/api',
      endpoints: {
        getData: endpoint.get<string>('/data'),
      },
    });

    expect(api.slice).toBeDefined();
    expect(api.slice.reducer).toBeDefined();
    expect(typeof api.slice.reducer).toBe('function');
  });

  it('returns actions object', () => {
    const api = defineApi({
      name: 'test',
      baseUrl: '/api',
      endpoints: {
        getData: endpoint.get<string>('/data'),
      },
    });

    expect(api.actions).toBeDefined();
    expect(typeof api.actions).toBe('object');
  });

  it('creates direct-call function for GET endpoint', () => {
    const api = defineApi({
      name: 'test',
      baseUrl: '/api',
      endpoints: {
        getData: endpoint.get<string>('/data'),
      },
    });

    expect(typeof api.getData).toBe('function');
  });

  it('creates direct-call function for POST endpoint', () => {
    const api = defineApi({
      name: 'test',
      baseUrl: '/api',
      endpoints: {
        createData: endpoint.post<string, { name: string }>('/data'),
      },
    });

    expect(typeof api.createData).toBe('function');
  });

  it('creates React hooks for endpoints', () => {
    const api = defineApi({
      name: 'test',
      baseUrl: '/api',
      endpoints: {
        getData: endpoint.get<string>('/data'),
        createData: endpoint.post<string, { name: string }>('/data'),
      },
    });

    expect(typeof api.useGetData).toBe('function');
    expect(typeof api.useCreateData).toBe('function');
  });
});
