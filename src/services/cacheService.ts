interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

class CacheService {
    private prefix = 'gravity_cache_';

    get<T>(key: string): T | null {
        try {
            const raw = localStorage.getItem(this.prefix + key);
            if (!raw) return null;

            const entry: CacheEntry<T> = JSON.parse(raw);
            const now = Date.now();

            if (now - entry.timestamp > entry.ttl) {
                this.remove(key);
                return null;
            }

            return entry.data;
        } catch {
            return null;
        }
    }

    set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
        try {
            const entry: CacheEntry<T> = {
                data,
                timestamp: Date.now(),
                ttl: ttlMs,
            };
            localStorage.setItem(this.prefix + key, JSON.stringify(entry));
        } catch (error) {
            console.warn('Cache write failed:', error);
        }
    }

    remove(key: string): void {
        localStorage.removeItem(this.prefix + key);
    }

    clear(): void {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(this.prefix));
        keys.forEach(k => localStorage.removeItem(k));
    }
}

export const cacheService = new CacheService();
export const CACHE_KEYS = {
    PAYMENT_METHOD_ORDER: 'payment_method_order',
};
export const CACHE_TTL = {
    PAYMENT_METHOD_ORDER: 12 * 60 * 60 * 1000, // 12 hours - configurable
};
