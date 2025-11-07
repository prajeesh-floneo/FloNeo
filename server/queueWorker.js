const Bull = require('bull');
const path = require('path');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const queueName = 'workflow-queue';

console.log('[QUEUE-WORKER] Starting worker for', queueName, 'connecting to', redisUrl);

const queue = new Bull(queueName, { redis: { url: redisUrl } });

queue.process(async (job) => {
  try {
    const { nodes, edges, context, appId, userId } = job.data;
    // Require the workflow runner from routes (exports.runWorkflow)
    const wfModule = require(path.join(__dirname, 'routes', 'workflow-execution'));
    if (!wfModule || typeof wfModule.runWorkflow !== 'function') {
      throw new Error('runWorkflow not available in workflow-execution module');
    }

    console.log('[QUEUE-WORKER] Processing job for appId:', appId, 'workflowId:', context?.workflowId || 'unknown');
    const result = await wfModule.runWorkflow(nodes || [], edges || [], context || {}, appId, userId || 1);
    console.log('[QUEUE-WORKER] Job completed:', result && result.success ? 'success' : 'failed');
    return result;
  } catch (err) {
    console.error('[QUEUE-WORKER] Job error:', err && err.message ? err.message : err);
    throw err;
  }
});

queue.on('failed', (job, err) => {
  console.error('[QUEUE-WORKER] Job failed:', job.id, err && err.message ? err.message : err);
});

queue.on('error', (err) => {
  console.error('[QUEUE-WORKER] Queue error:', err && err.message ? err.message : err);
});

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
console.log('[QUEUE-WORKER] Worker is listening for jobs...');
=======
console.log('[QUEUE-WORKER] Worker is listening for jobs...');
>>>>>>> 000b9a8 (Modified workflow files and added queueWorker, webhook tests, and workflow queue utility)
=======
console.log('[QUEUE-WORKER] Worker is listening for jobs...');
>>>>>>> 306aa40 (fixed app name issue changed client/app/canvas/page.tsx,app/dashboard.tsx,components/rename-modal.tsx,queueWorker.js)
=======
console.log('[QUEUE-WORKER] Worker is listening for jobs...');
>>>>>>> 306aa40 (fixed app name issue changed client/app/canvas/page.tsx,app/dashboard.tsx,components/rename-modal.tsx,queueWorker.js)
