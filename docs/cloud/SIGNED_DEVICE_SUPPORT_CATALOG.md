# Signed device-support catalog

This catalog is an exact-model distribution policy layered above the existing BootForge chipset and workflow catalogs. It does not replace local firmware, workflow, identity, authorization, or physical-qualification gates.

Every entry is fail-closed: `executionAuthorized:false`, physical qualification remains mandatory for writes, and spoofing, FRP bypass, rollback, unsigned loaders, and security-state bypass remain explicitly prohibited.

Production distribution will wrap the canonical catalog in a detached AWS KMS or Google Cloud KMS signature. Clients verify the signature and digest before using catalog metadata. A valid catalog signature proves publisher integrity only; it never grants device-write authority.
