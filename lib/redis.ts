import { createClient, type RedisClientType } from "redis";
let client: RedisClientType | null = null;
let tried = false;

// Returns a connected client, or null if REDIS_URL is unset / connection fails.
// All callers must treat null as "use in-memory fallback".
export async function getRedis(): Promise<RedisClientType | null> {
  if (client) return client;
  if (tried) return null;
  tried = true;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const c: RedisClientType = createClient({ url });
    c.on("error", () => {});
    await c.connect();
    client = c;
    return client;
  } catch {
    return null;
  }
}