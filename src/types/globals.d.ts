declare interface Env {
  DB: D1Database;
  CONFIG_KV: KVNamespace;
  MEDIA_BUCKET: R2Bucket;
  TASK_QUEUE: Queue;
  AUTH_SHARED_PASSWORD_HASH?: string;
  AUTH_SESSION_SECRET?: string;
  AUTH_VERSION?: string;
  AUTH_COMMIT?: string;
  PLATFORM_CONFIG_KV_KEY?: string;
}

declare interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
}
