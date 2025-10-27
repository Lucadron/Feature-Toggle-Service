import { createClient } from 'redis';

// Initialize Redis Client
const redisClient = createClient({
    // Docker'daki Redis'e bağlanır
    url: 'redis://localhost:6379',
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

// Connect to Redis
(async () => {
    await redisClient.connect();
    console.log('Connected to Redis successfully.');
})();

const CACHE_TTL = parseInt(process.env.CACHE_TTL || '60', 10); // 60 saniye

/**
 * Gets a value from the cache.
 * @param key The cache key
 * @returns The cached value (string) or null
 */
export const getFromCache = async (key: string): Promise<string | null> => {
    try {
        return await redisClient.get(key);
    } catch (err) {
        console.error(`Error getting from cache: ${err}`);
        return null;
    }
};

/**
 * Sets a value in the cache with a TTL.
 * @param key The cache key
 * @param value The value to cache (will be stringified)
 */
export const setInCache = async (
    key: string,
    value: unknown,
): Promise<void> => {
    try {
        await redisClient.set(key, JSON.stringify(value), {
            EX: CACHE_TTL, // Set expiration
        });
    } catch (err) {
        console.error(`Error setting in cache: ${err}`);
    }
};

/**
 * Deletes a value from the cache.
 * @param key The cache key
 */
export const deleteFromCache = async (key: string): Promise<void> => {
    try {
        await redisClient.del(key);
    } catch (err) {
        console.error(`Error deleting from cache: ${err}`);
    }
};

/**
 * Creates a standardized cache key.
 * @param tenantId
 * @param env
 * @returns A string like 'features:tenantId:env'
 */
export const createCacheKey = (tenantId: string, env: string): string => {
    return `features:${tenantId}:${env}`;
};