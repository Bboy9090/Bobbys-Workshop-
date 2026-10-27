use std::sync::{Arc, OnceLock};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

pub const MAX_OBSERVATION_WORKERS: usize = 2;

static OBSERVATION_SEMAPHORE: OnceLock<Arc<Semaphore>> = OnceLock::new();

fn observation_semaphore() -> Arc<Semaphore> {
    OBSERVATION_SEMAPHORE
        .get_or_init(|| Arc::new(Semaphore::new(MAX_OBSERVATION_WORKERS)))
        .clone()
}

pub async fn acquire_observation_permit() -> Result<OwnedSemaphorePermit, String> {
    observation_semaphore()
        .acquire_owned()
        .await
        .map_err(|_| "Observation worker semaphore closed unexpectedly.".to_string())
}

pub fn available_observation_permits() -> usize {
    observation_semaphore().available_permits()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn observation_scheduler_is_intentionally_small() {
        assert_eq!(MAX_OBSERVATION_WORKERS, 2);
        assert_eq!(available_observation_permits(), 2);
    }
}
