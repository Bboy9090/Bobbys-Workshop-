# Privacy-safe observability

BobFWTools frontend crash/error reporting is opt-in and disabled unless both `VITE_OBSERVABILITY_ENABLED=true` and an HTTPS `VITE_SENTRY_DSN` are provided at build time.

The Sentry SDK is configured with data collection disabled for user identity, cookies, HTTP headers and bodies, query parameters, GraphQL payloads, generative-AI/MCP content, database query data, queue arguments, stack-frame local variables, and source context. Performance tracing is disabled (`tracesSampleRate=0`).

A second sanitizer runs before events and breadcrumbs leave the application. It removes user objects and request payloads, reduces HTTP(S) URLs to their origin, rejects local `file:` URLs, redacts filesystem paths, and redacts sensitive keys such as device serials, IMEI/MEID/UDID, firmware fingerprints, tokens, credentials, and file paths.

Observability is diagnostic only. It cannot change device state, firmware policy, qualification state, release policy, remote configuration, or physical write authority.
