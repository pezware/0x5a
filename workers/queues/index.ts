export default {
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const message of batch.messages) {
      // No-op placeholder
      await env.TASK_QUEUE.send(message.body);
      message.ack();
    }
  }
};

type Env = {
  TASK_QUEUE: Queue;
};
