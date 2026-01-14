import type { EndpointConfig, RequestOptions, ApiConfig } from './types';
import { getGlobalConfig } from './config';
import { generateCacheKey } from './util';
import { getInFlightRequest, setInFlightRequest, deleteInFlightRequest } from './registry';

export async function executeRequest<TResponse>(
  baseUrl: string,
  config: EndpointConfig<TResponse, any>,
  options: RequestOptions<any> | undefined,
  instanceConfig: ApiConfig | undefined,
  context: { getState: any; dispatch: any }
): Promise<TResponse> {
  const globalConfig = getGlobalConfig();
  let finalOptions = { ...options };

  // Phase 1: Request Interceptor (Global then Instance)
  if (globalConfig.interceptors?.onRequest) {
    finalOptions = await globalConfig.interceptors.onRequest(finalOptions);
  }
  if (instanceConfig?.interceptors?.onRequest) {
    finalOptions = await instanceConfig.interceptors.onRequest(finalOptions);
  }

  // Phase 3: Deduplication Key
  const cacheKey = generateCacheKey(baseUrl, config.path, config.method, finalOptions);

  // Return in-flight request if exists
  const inFlight = getInFlightRequest(cacheKey);
  if (inFlight) return inFlight;

  const requestPromise = (async () => {
    try {
      const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      let path = config.path;
      const remainingParams = { ...finalOptions?.params };

      if (finalOptions?.params) {
        Object.entries(finalOptions.params).forEach(([key, value]) => {
          const placeholder = `:${key}`;
          if (path.includes(placeholder)) {
            path = path.replace(placeholder, String(value));
            delete remainingParams[key];
          }
        });
      }

      const cleanPath = path.startsWith('/') ? path : '/' + path;
      const fullPath = cleanBase + cleanPath;

      const isAbsolute = fullPath.includes('://');
      const dummyBase = 'http://localhost';
      const url = new URL(fullPath, isAbsolute ? undefined : dummyBase);

      if (Object.keys(remainingParams).length > 0) {
        Object.entries(remainingParams).forEach(([key, value]) => {
          url.searchParams.append(key, String(value));
        });
      }

      const finalUrl = isAbsolute ? url.toString() : url.pathname + url.search;

      // Prepare Headers
      let headers: Record<string, string> = {
        ...finalOptions?.headers,
      };

      const isFormData = typeof window !== 'undefined' && finalOptions?.body instanceof FormData;

      if (!isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      // Simple Headers Callback (Global)
      if (globalConfig.headers) {
        const globalHeaders = await globalConfig.headers();
        Object.entries(globalHeaders).forEach(([key, value]) => {
          if (!headers[key]) headers[key] = value;
        });
      }

      // Simple Headers Callback (Instance)
      if (instanceConfig?.headers) {
        const instanceHeaders = await instanceConfig.headers();
        Object.entries(instanceHeaders).forEach(([key, value]) => {
          if (!headers[key]) headers[key] = value;
        });
      }

      let finalHeaders: Headers | Record<string, string> = headers;

      if (instanceConfig?.prepareHeaders) {
        let headersObj = new Headers(headers);
        const result = instanceConfig.prepareHeaders(headersObj, {
          getState: context.getState,
          endpoint: config.path,
        });
        if (result instanceof Headers) {
          finalHeaders = result;
        } else {
          finalHeaders = headersObj;
        }
      }

      const fetchOptions: RequestInit = {
        method: config.method,
        headers: finalHeaders,
      };

      if (finalOptions?.body && (config.method === 'POST' || config.method === 'PUT' || config.method === 'PATCH')) {
        fetchOptions.body = isFormData ? (finalOptions.body as any) : JSON.stringify(finalOptions.body);
      }

      let attempts = 0;
      const maxAttempts = (config.retry || 0) + 1;
      let lastError: any;

      while (attempts < maxAttempts) {
        try {
          const response = await fetch(finalUrl, fetchOptions);

          if (!response.ok) {
            // Phase 1: Response Error Interceptor (Instance then Global)
            if (instanceConfig?.interceptors?.onResponseError) {
              await instanceConfig.interceptors.onResponseError(response);
            }
            if (globalConfig.interceptors?.onResponseError) {
              await globalConfig.interceptors.onResponseError(response);
            }

            // Global and Instance onError Handler
            if (instanceConfig?.onError) {
              instanceConfig.onError(
                { status: response.status, statusText: response.statusText, response },
                { dispatch: context.dispatch, getState: context.getState }
              );
            } else if (globalConfig.onError) {
              globalConfig.onError(
                { status: response.status, statusText: response.statusText, response },
                { dispatch: context.dispatch, getState: context.getState }
              );
            }

            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return await response.json();
          }

          return (await response.text()) as unknown as TResponse;
        } catch (error) {
          attempts++;
          lastError = error;
          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
      throw lastError;
    } finally {
      // Clean up in-flight tracker
      deleteInFlightRequest(cacheKey);
    }
  })();

  setInFlightRequest(cacheKey, requestPromise);
  return requestPromise;
}
