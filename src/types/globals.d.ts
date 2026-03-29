declare interface Env {
  DB: D1Database;
  CONFIG_KV: KVNamespace;
  MEDIA_BUCKET: R2Bucket;
  TASK_QUEUE: Queue;
}

declare interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
}
