const Bull = require('bull');

// Use REDIS_URL env var or default to localhost
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Queue name
const queueName = 'workflow-queue';

let queue = null;
try {
  queue = new Bull(queueName, { redis: { url: redisUrl } });
} catch (e) {
  console.warn('[WORKFLOW-QUEUE] Failed to initialize Bull queue, falling back to in-memory queue', e.message || e);
}

// Fallback in-memory queue if Bull not available
const inMemoryQueue = [];
let processing = false;

const enqueueWorkflow = async (nodes, edges, context, appId, userId = 1) => {
  if (queue) {
    // Add job to Bull queue
    await queue.add({ nodes, edges, context, appId, userId }, { removeOnComplete: true, attempts: 3 });
    return;
  }

  // Fallback push
  inMemoryQueue.push({ nodes, edges, context, appId, userId });
  if (!processing) processInMemoryQueue();
};

const processInMemoryQueue = async () => {
  if (processing) return;
  processing = true;
  while (inMemoryQueue.length > 0) {
    const job = inMemoryQueue.shift();
    try {
      // Try to require runner dynamically from routes to avoid circular dependency
      const runner = require('../routes/workflow-execution').runWorkflow;
      if (runner) await runner(job.nodes, job.edges, job.context, job.appId, job.userId);
    } catch (err) {
      console.error('[WORKFLOW-QUEUE] In-memory job failed:', err && err.message ? err.message : err);
    }
  }
  processing = false;
};

module.exports = {
  enqueueWorkflow,
  _bullQueue: queue, // exported for worker to attach if needed
};
