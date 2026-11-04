# Safe remote configuration and secrets

AWS Secrets Manager stores release-service secrets without committing secret values to source control. Secret values are provisioned separately; Terraform creates only the protected secret container and scoped read access.

AWS AppConfig is limited to non-destructive runtime settings: diagnostics, telemetry sampling, catalog refresh, cloud publication disable/enable, release-channel selection, and bounded observation tuning.

The JSON schema uses `additionalProperties:false`, and the repository validator separately rejects keys containing destructive concepts such as write, flash, wipe, unlock, FRP, bypass, execution, or authorization. Remote configuration therefore cannot become a hidden device-write authority channel.

AppConfig uses a gradual linear deployment strategy. Existing local authorization, physical qualification, exact-target, firmware, and audit gates remain authoritative.
