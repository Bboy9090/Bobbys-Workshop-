// Job System - Fiber-Based, No Blocking Threads
// Part of The Forge Doctrine: Performance Over Convenience

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use crossbeam::deque::{Injector, Stealer, Worker};
use std::thread;

pub type JobFn = Box<dyn FnOnce() + Send>;

pub struct Job {
    pub func: JobFn,
    pub counter: Arc<JobCounter>,
}

pub struct JobCounter {
    count: AtomicU32,
}

impl JobCounter {
    pub fn new(initial: u32) -> Self {
        Self {
            count: AtomicU32::new(initial),
        }
    }

    pub fn increment(&self) {
        self.count.fetch_add(1, Ordering::SeqCst);
    }

    pub fn decrement(&self) -> u32 {
        self.count.fetch_sub(1, Ordering::SeqCst)
    }

    pub fn load(&self) -> u32 {
        self.count.load(Ordering::SeqCst)
    }

    pub fn wait(&self) {
        while self.count.load(Ordering::SeqCst) > 0 {
            thread::yield_now(); // Fiber yield would go here
        }
    }
}

pub struct JobSystem {
    workers: Vec<thread::JoinHandle<()>>,
    injector: Arc<Injector<Job>>,
    running: Arc<std::sync::atomic::AtomicBool>,
}

impl JobSystem {
    /// Create job system with fixed worker pool
    pub fn new(worker_count: usize) -> Self {
        let injector = Arc::new(Injector::new());
        let running = Arc::new(std::sync::atomic::AtomicBool::new(true));
        let mut workers = Vec::new();

        for _ in 0..worker_count {
            let injector_clone = injector.clone();
            let running_clone = running.clone();

            let handle = thread::spawn(move || {
                let worker = Worker::new_fifo();

                while running_clone.load(Ordering::SeqCst) {
                    // Try to steal from injector (work-stealing)
                    if let Some(job) = injector_clone.steal().success() {
                        (job.func)();
                        job.counter.decrement();
                        continue;
                    }

                    // Try to pop from own queue
                    if let Some(job) = worker.pop() {
                        (job.func)();
                        job.counter.decrement();
                        continue;
                    }

                    // Try to steal from other workers
                    let mut stolen = false;
                    for stealer in &[] {
                        if let Some(job) = stealer.steal().success() {
                            (job.func)();
                            job.counter.decrement();
                            stolen = true;
                            break;
                        }
                    }

                    if !stolen {
                        thread::yield_now(); // No work, yield
                    }
                }
            });

            workers.push(handle);
        }

        Self {
            workers,
            injector,
            running,
        }
    }

    /// Submit a job (non-blocking)
    pub fn submit(&self, job: Job) {
        job.counter.increment();
        self.injector.push(job);
    }

    /// Wait for counter to reach zero (fiber yield point)
    pub fn wait_for(&self, counter: &JobCounter) {
        counter.wait();
    }

    /// Shutdown all workers
    pub fn shutdown(self) {
        self.running.store(false, Ordering::SeqCst);
        for worker in self.workers {
            let _ = worker.join();
        }
    }
}

/// Frame barrier - ensures all jobs complete before next frame
pub struct FrameBarrier {
    counter: Arc<JobCounter>,
}

impl FrameBarrier {
    pub fn new() -> Self {
        Self {
            counter: Arc::new(JobCounter::new(0)),
        }
    }

    pub fn counter(&self) -> Arc<JobCounter> {
        self.counter.clone()
    }

    pub fn wait(&self) {
        self.counter.wait();
    }
}

/// Example frame scheduling
pub fn schedule_frame(job_system: &JobSystem, barrier: &FrameBarrier) {
    // Schedule physics
    let physics_job = Job {
        func: Box::new(|| {
            // Physics step
        }),
        counter: barrier.counter(),
    };
    job_system.submit(physics_job);

    // Schedule animation
    let anim_job = Job {
        func: Box::new(|| {
            // Animation step
        }),
        counter: barrier.counter(),
    };
    job_system.submit(anim_job);

    // Schedule AI
    let ai_job = Job {
        func: Box::new(|| {
            // AI step
        }),
        counter: barrier.counter(),
    };
    job_system.submit(ai_job);

    // Wait for all jobs
    barrier.wait();
}
