import { HttpMethod, RequestOptions } from './types';

export function generateCacheKey(baseUrl: string, path: string, method: HttpMethod, options?: RequestOptions): string {
    const parts = [
        method,
        baseUrl.replace(/\/$/, ''),
        path.startsWith('/') ? path : `/${path}`,
    ];

    if (options?.params) {
        const sortedParams = Object.keys(options.params)
            .sort()
            .map(key => `${key}=${options.params![key]}`)
            .join('&');
        if (sortedParams) parts.push(`params:${sortedParams}`);
    }

    if (options?.body) {
        parts.push(`body:${JSON.stringify(options.body)}`);
    }

    return parts.join('|');
}
