export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (new URL(request.url).pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', version: env.__STATIC_CONTENT_MANIFEST ?? 'dev' }), {
        headers: { 'content-type': 'application/json' }
      });
    }
    return new Response('API worker placeholder', { status: 200 });
  }
};

type Env = {
  DB: D1Database;
  CONFIG_KV: KVNamespace;
  MEDIA_BUCKET: R2Bucket;
  TASK_QUEUE: Queue;
};
