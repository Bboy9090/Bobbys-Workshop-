//! Deterministic, test-only transport fault simulation. Never opens a device.
#![cfg(test)]
use std::io;

#[derive(Clone, Copy)]
pub enum Fault { None, ShortWrite(usize), Timeout, Disconnect, Corrupt }

pub struct SimulatedTransport { fault: Fault, calls: usize }
impl SimulatedTransport {
    pub fn new(fault: Fault) -> Self { Self { fault, calls: 0 } }
    pub fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.calls += 1;
        match self.fault {
            Fault::None => Ok(bytes.len()),
            Fault::ShortWrite(limit) => Ok(bytes.len().min(limit)),
            Fault::Timeout => Err(io::Error::new(io::ErrorKind::TimedOut, "simulated timeout")),
            Fault::Disconnect => Err(io::Error::new(io::ErrorKind::ConnectionAborted, "simulated disconnect")),
            Fault::Corrupt => Err(io::Error::new(io::ErrorKind::InvalidData, "simulated integrity failure")),
        }
    }
}

/// A single bounded test transaction. Never retries a partial write implicitly.
pub fn verify_transaction(transport: &mut SimulatedTransport, bytes: &[u8]) -> io::Result<()> {
    if bytes.is_empty() { return Err(io::Error::new(io::ErrorKind::InvalidInput, "empty payload")); }
    let written = transport.write(bytes)?;
    if written != bytes.len() { return Err(io::Error::new(io::ErrorKind::WriteZero, "partial write")); }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn complete_write_is_accepted() { assert!(verify_transaction(&mut SimulatedTransport::new(Fault::None), &[1; 512]).is_ok()); }
    #[test] fn short_write_is_rejected() { assert_eq!(verify_transaction(&mut SimulatedTransport::new(Fault::ShortWrite(128)), &[1; 512]).unwrap_err().kind(), io::ErrorKind::WriteZero); }
    #[test] fn timeout_is_rejected() { assert_eq!(verify_transaction(&mut SimulatedTransport::new(Fault::Timeout), &[1]).unwrap_err().kind(), io::ErrorKind::TimedOut); }
    #[test] fn disconnect_is_rejected() { assert_eq!(verify_transaction(&mut SimulatedTransport::new(Fault::Disconnect), &[1]).unwrap_err().kind(), io::ErrorKind::ConnectionAborted); }
    #[test] fn corrupt_feedback_is_rejected() { assert_eq!(verify_transaction(&mut SimulatedTransport::new(Fault::Corrupt), &[1]).unwrap_err().kind(), io::ErrorKind::InvalidData); }
    #[test] fn zero_progress_is_rejected() { assert_eq!(verify_transaction(&mut SimulatedTransport::new(Fault::ShortWrite(0)), &[1]).unwrap_err().kind(), io::ErrorKind::WriteZero); }
    #[test]
    fn repeated_disconnects_never_become_success() {
        let mut transport = SimulatedTransport::new(Fault::Disconnect);
        for _ in 0..100 {
            assert_eq!(verify_transaction(&mut transport, &[7; 256]).unwrap_err().kind(), io::ErrorKind::ConnectionAborted);
        }
        assert_eq!(transport.calls, 100);
    }
    #[test]
    fn repeated_timeouts_never_become_success() {
        let mut transport = SimulatedTransport::new(Fault::Timeout);
        for _ in 0..100 {
            assert_eq!(verify_transaction(&mut transport, &[7; 256]).unwrap_err().kind(), io::ErrorKind::TimedOut);
        }
        assert_eq!(transport.calls, 100);
    }
    #[test]
    fn repeated_short_writes_never_become_success() {
        let mut transport = SimulatedTransport::new(Fault::ShortWrite(32));
        for _ in 0..100 {
            assert_eq!(verify_transaction(&mut transport, &[7; 256]).unwrap_err().kind(), io::ErrorKind::WriteZero);
        }
        assert_eq!(transport.calls, 100);
    }
    #[test]
    fn mixed_failure_sequence_isolated_between_sessions() {
        let faults = [Fault::Timeout, Fault::Disconnect, Fault::ShortWrite(32), Fault::Corrupt];
        let expected = [io::ErrorKind::TimedOut, io::ErrorKind::ConnectionAborted, io::ErrorKind::WriteZero, io::ErrorKind::InvalidData];
        for _ in 0..25 {
            for (fault, kind) in faults.iter().zip(expected.iter()) {
                let mut session = SimulatedTransport::new(*fault);
                assert_eq!(verify_transaction(&mut session, &[0x1a; 1024]).unwrap_err().kind(), *kind);
                assert_eq!(session.calls, 1);
            }
            let mut fresh = SimulatedTransport::new(Fault::None);
            assert!(verify_transaction(&mut fresh, &[0x1a; 1024]).is_ok());
            assert_eq!(fresh.calls, 1);
        }
    }
    #[test] fn empty_payload_is_rejected_without_dispatch() { let mut t = SimulatedTransport::new(Fault::None); assert_eq!(verify_transaction(&mut t, &[]).unwrap_err().kind(), io::ErrorKind::InvalidInput); assert_eq!(t.calls, 0); }
}
