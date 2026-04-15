import { HttpMethod, RequestOptions } from './types';

function stableStringify(value: unknown): string {
    const seen = new WeakSet<object>();

    const stringify = (v: any): any => {
        if (v === null || v === undefined) return v;
        if (typeof v !== 'object') return v;

        if (v instanceof Date) return { $date: v.toISOString() };
        if (typeof FormData !== 'undefined' && v instanceof FormData) return { $formData: true };

        if (seen.has(v)) return { $circular: true };
        seen.add(v);

        if (Array.isArray(v)) return v.map(stringify);

        const out: Record<string, any> = {};
        Object.keys(v).sort().forEach((k) => {
            out[k] = stringify(v[k]);
        });
        return out;
    };

    try {
        return JSON.stringify(stringify(value));
    } catch {
        return '"[unserializable]"';
    }
}

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
        parts.push(`body:${stableStringify(options.body)}`);
    }

    return parts.join('|');
}
