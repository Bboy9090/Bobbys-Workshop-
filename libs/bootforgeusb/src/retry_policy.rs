use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum TransportOperationClass {
    Enumerate,
    Handshake,
    ReadOnly,
    WriteCommand,
    WriteStream,
    Verify,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetryContext {
    pub operation: TransportOperationClass,
    pub attempt: u32,
    pub max_attempts: u32,
    pub device_identity_unchanged: bool,
    pub artifact_hash_unchanged: bool,
    pub resume_offset: Option<u64>,
    pub acknowledged_offset: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetryDecision {
    pub retry_allowed: bool,
    pub reconnect_allowed: bool,
    pub requires_revalidation: bool,
    pub requires_exact_resume_offset: bool,
    pub delay_ms: u64,
    pub reason: String,
}

pub fn decide_retry(ctx: &RetryContext) -> RetryDecision {
    if ctx.attempt >= ctx.max_attempts {
        return RetryDecision {
            retry_allowed: false,
            reconnect_allowed: false,
            requires_revalidation: false,
            requires_exact_resume_offset: false,
            delay_ms: 0,
            reason: "maximum retry attempts reached".to_string(),
        };
    }

    if !ctx.device_identity_unchanged || !ctx.artifact_hash_unchanged {
        return RetryDecision {
            retry_allowed: false,
            reconnect_allowed: false,
            requires_revalidation: true,
            requires_exact_resume_offset: false,
            delay_ms: 0,
            reason: "device identity or artifact hash changed; retry is blocked".to_string(),
        };
    }

    let delay_ms = 1000u64
        .saturating_mul(1u64 << ctx.attempt.min(5));

    match ctx.operation {
        TransportOperationClass::Enumerate
        | TransportOperationClass::Handshake
        | TransportOperationClass::ReadOnly
        | TransportOperationClass::Verify => RetryDecision {
            retry_allowed: true,
            reconnect_allowed: true,
            requires_revalidation: true,
            requires_exact_resume_offset: false,
            delay_ms,
            reason: "operation is idempotent/read-only and may be retried after revalidation".to_string(),
        },
        TransportOperationClass::WriteCommand => RetryDecision {
            retry_allowed: false,
            reconnect_allowed: false,
            requires_revalidation: true,
            requires_exact_resume_offset: false,
            delay_ms: 0,
            reason: "write command retry is blocked unless the protocol proves command idempotence".to_string(),
        },
        TransportOperationClass::WriteStream => {
            let exact = ctx.resume_offset.is_some()
                && ctx.resume_offset == ctx.acknowledged_offset;
            RetryDecision {
                retry_allowed: exact,
                reconnect_allowed: false,
                requires_revalidation: true,
                requires_exact_resume_offset: true,
                delay_ms: if exact { delay_ms } else { 0 },
                reason: if exact {
                    "write stream may resume only from the exact device-acknowledged offset after full revalidation".to_string()
                } else {
                    "write stream retry blocked: exact acknowledged resume offset is unavailable".to_string()
                },
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handshake_retry_allowed_after_identity_check() {
        let decision = decide_retry(&RetryContext {
            operation: TransportOperationClass::Handshake,
            attempt: 0,
            max_attempts: 3,
            device_identity_unchanged: true,
            artifact_hash_unchanged: true,
            resume_offset: None,
            acknowledged_offset: None,
        });
        assert!(decision.retry_allowed);
    }

    #[test]
    fn write_stream_without_exact_resume_is_blocked() {
        let decision = decide_retry(&RetryContext {
            operation: TransportOperationClass::WriteStream,
            attempt: 0,
            max_attempts: 3,
            device_identity_unchanged: true,
            artifact_hash_unchanged: true,
            resume_offset: Some(4096),
            acknowledged_offset: Some(2048),
        });
        assert!(!decision.retry_allowed);
    }
}
