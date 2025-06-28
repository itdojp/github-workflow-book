/**
 * Parallel Processing Manager
 * Manages Worker Threads for concurrent file processing
 */

const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');

class ParallelProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxWorkers = options.maxWorkers || Math.min(os.cpus().length, 8);
    this.workerScript = path.join(__dirname, 'workers', 'file-processor.js');
    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers = 0;
    this.completedTasks = 0;
    this.totalTasks = 0;
    this.results = [];
    this.errors = [];
  }

  /**
   * Process files in parallel
   * @param {Array} tasks - Array of task objects
   * @returns {Promise} - Resolves when all tasks are complete
   */
  async processTasks(tasks) {
    this.taskQueue = [...tasks];
    this.totalTasks = tasks.length;
    this.completedTasks = 0;
    this.results = [];
    this.errors = [];

    return new Promise((resolve, reject) => {
      this.on('complete', resolve);
      this.on('failed', reject);
      
      // Start initial batch of workers
      this.startWorkers();
    });
  }

  startWorkers() {
    const workersToStart = Math.min(this.taskQueue.length, this.maxWorkers);
    
    for (let i = 0; i < workersToStart; i++) {
      this.startWorker();
    }
  }

  startWorker() {
    if (this.taskQueue.length === 0) {
      return;
    }

    const task = this.taskQueue.shift();
    this.activeWorkers++;

    const worker = new Worker(this.workerScript, {
      workerData: task
    });

    worker.on('message', (result) => {
      this.handleWorkerResult(result, worker);
    });

    worker.on('error', (error) => {
      this.handleWorkerError(error, worker, task);
    });

    worker.on('exit', (code) => {
      this.activeWorkers--;
      if (code !== 0) {
        this.handleWorkerError(new Error(`Worker stopped with exit code ${code}`), worker, task);
      }
    });

    this.workers.push(worker);
  }

  handleWorkerResult(result, worker) {
    this.completedTasks++;
    
    if (result.type === 'error') {
      this.errors.push(result);
      this.emit('taskError', result);
    } else {
      this.results.push(result);
      this.emit('taskComplete', result);
    }

    // Emit progress
    this.emit('progress', {
      completed: this.completedTasks,
      total: this.totalTasks,
      percentage: Math.round((this.completedTasks / this.totalTasks) * 100)
    });

    // Clean up worker
    worker.terminate();
    this.removeWorker(worker);

    // Start next task if available
    if (this.taskQueue.length > 0) {
      this.startWorker();
    } else if (this.activeWorkers === 0) {
      // All tasks completed
      this.emit('complete', {
        results: this.results,
        errors: this.errors,
        totalTasks: this.totalTasks,
        completedTasks: this.completedTasks
      });
    }
  }

  handleWorkerError(error, worker, task) {
    this.completedTasks++;
    this.errors.push({
      type: 'error',
      srcPath: task.srcPath,
      error: {
        message: error.message,
        stack: error.stack
      }
    });

    this.emit('taskError', { error, task });

    // Clean up worker
    worker.terminate();
    this.removeWorker(worker);

    // Continue with next task
    if (this.taskQueue.length > 0) {
      this.startWorker();
    } else if (this.activeWorkers === 0) {
      // Check if we should fail or continue
      if (this.errors.length === this.totalTasks) {
        this.emit('failed', new Error('All tasks failed'));
      } else {
        this.emit('complete', {
          results: this.results,
          errors: this.errors,
          totalTasks: this.totalTasks,
          completedTasks: this.completedTasks
        });
      }
    }
  }

  removeWorker(worker) {
    const index = this.workers.indexOf(worker);
    if (index > -1) {
      this.workers.splice(index, 1);
    }
  }

  /**
   * Terminate all workers
   */
  async terminate() {
    const terminationPromises = this.workers.map(worker => worker.terminate());
    await Promise.all(terminationPromises);
    this.workers = [];
    this.activeWorkers = 0;
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      maxWorkers: this.maxWorkers,
      activeWorkers: this.activeWorkers,
      completedTasks: this.completedTasks,
      totalTasks: this.totalTasks,
      remainingTasks: this.taskQueue.length,
      successfulTasks: this.results.length,
      failedTasks: this.errors.length
    };
  }
}

module.exports = ParallelProcessor;