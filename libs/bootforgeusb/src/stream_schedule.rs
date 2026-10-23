//! Allocation-bounded transfer planning and metrics for native USB sessions.
//! Pure functions only: no device opening, endpoint claims, or payload writes.
use std::time::Duration;

pub const DEFAULT_CHUNK_BYTES: usize = 256 * 1024;
pub const MAX_CHUNK_BYTES: usize = 1024 * 1024;
pub const MAX_IN_FLIGHT: usize = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StreamConfig {
    pub chunk_bytes: usize,
    pub in_flight: usize,
}

impl StreamConfig {
    pub fn validated(self) -> Option<Self> {
        if self.chunk_bytes == 0 || self.chunk_bytes > MAX_CHUNK_BYTES ||
            self.in_flight == 0 || self.in_flight > MAX_IN_FLIGHT {
            return None;
        }
        self.chunk_bytes.checked_mul(self.in_flight)?;
        Some(self)
    }

    pub fn max_buffer_bytes(self) -> Option<usize> {
        let cfg = self.validated()?;
        cfg.chunk_bytes.checked_mul(cfg.in_flight)
    }
}

impl Default for StreamConfig {
    fn default() -> Self {
        Self { chunk_bytes: DEFAULT_CHUNK_BYTES, in_flight: 4 }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Chunk {
    pub offset: u64,
    pub len: usize,
}

pub struct ChunkPlan {
    total: u64,
    next: u64,
    chunk_bytes: usize,
}

impl ChunkPlan {
    pub fn new(total: u64, config: StreamConfig) -> Option<Self> {
        Some(Self { total, next: 0, chunk_bytes: config.validated()?.chunk_bytes })
    }
}

impl Iterator for ChunkPlan {
    type Item = Chunk;

    fn next(&mut self) -> Option<Self::Item> {
        if self.next >= self.total {
            return None;
        }
        let remaining = self.total - self.next;
        let len = remaining.min(self.chunk_bytes as u64) as usize;
        let chunk = Chunk { offset: self.next, len };
        self.next += len as u64;
        Some(chunk)
    }
}

/// Bytes per second measured from completed transfers, not scheduled bytes.
pub fn completed_bytes_per_second(bytes: u64, elapsed: Duration) -> Option<f64> {
    let seconds = elapsed.as_secs_f64();
    if seconds <= 0.0 || !seconds.is_finite() { return None; }
    Some(bytes as f64 / seconds)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounded_tail_and_offsets() {
        let cfg = StreamConfig { chunk_bytes: 1024, in_flight: 2 };
        let chunks: Vec<_> = ChunkPlan::new(2500, cfg).unwrap().collect();
        assert_eq!(chunks, vec![
            Chunk { offset: 0, len: 1024 },
            Chunk { offset: 1024, len: 1024 },
            Chunk { offset: 2048, len: 452 },
        ]);
        assert_eq!(cfg.max_buffer_bytes(), Some(2048));
    }

    #[test]
    fn empty_payload_has_no_chunks() {
        assert_eq!(ChunkPlan::new(0, StreamConfig::default()).unwrap().count(), 0);
    }

    #[test]
    fn rejects_unbounded_configuration() {
        assert!(StreamConfig { chunk_bytes: 0, in_flight: 1 }.validated().is_none());
        assert!(StreamConfig { chunk_bytes: MAX_CHUNK_BYTES + 1, in_flight: 1 }.validated().is_none());
        assert!(StreamConfig { chunk_bytes: 1024, in_flight: MAX_IN_FLIGHT + 1 }.validated().is_none());
    }

    #[test]
    fn throughput_uses_completed_bytes() {
        assert_eq!(completed_bytes_per_second(4096, Duration::from_secs(2)), Some(2048.0));
        assert_eq!(completed_bytes_per_second(4096, Duration::ZERO), None);
    }
}
