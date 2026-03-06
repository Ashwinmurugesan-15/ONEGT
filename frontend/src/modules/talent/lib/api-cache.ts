
// Simple in-memory cache for API responses to prevent 429 Too Many Requests
// Note: In a production environment with multiple instances, a real cache like Redis would be needed.
// For development and single-instance setup, this works well.

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

// Cache duration: 30 seconds
const CACHE_DURATION_MS = 30 * 1000;

export const apiCache = {
    get<T>(key: string): T | null {
        const entry = cache.get(key);
        if (!entry) return null;

        const isExpired = Date.now() - entry.timestamp > CACHE_DURATION_MS;
        if (isExpired) {
            cache.delete(key);
            return null;
        }

        return entry.data;
    },

    set<T>(key: string, data: T): void {
        cache.set(key, {
            data,
            timestamp: Date.now()
        });
    },

    clear(key?: string): void {
        if (key) {
            cache.delete(key);
        } else {
            cache.clear();
        }
    }
};
