# @betng/service-kit

Shared bootstrap for the TypeScript services: configuration, logging, request ids, the error envelope, health and readiness, metrics, RPC, the WebSocket adapter and the process runner.

## Errors

Handlers throw `HttpError` or a `DomainError`. Anything without a status becomes `500 INTERNAL_ERROR` with `OPAQUE_ERROR_MESSAGE`, which lives in `@betng/contracts/runtime` and is paired with `OPAQUE_MESSAGE` in `services/shared/src/betng_service_kit/errors.py`. Every error response carries `x-request-id`. Logs record the request id, the error name and a message truncated to 500 characters; stack traces are logged only when `NODE_ENV` is `development` or `test`.

## Process runner

`runService` starts the server and installs handlers for `SIGINT`, `SIGTERM`, `unhandledRejection` and `uncaughtException`. Each one drains the HTTP server (in-flight requests get `SHUTDOWN_DRAIN_MS`, default 10000), runs the service's `onShutdown` steps in order, flushes the logger and exits: `0` for a signal, `1` for a rejection, an exception or a failed step. `SHUTDOWN_TIMEOUT_MS` (default 15000) forces exit `1` if the whole sequence hangs.

## Metrics

Every service server answers `GET /metrics` in Prometheus text format: `http_requests_total` and `http_request_duration_seconds` (histogram) by method, route template and status, plus process CPU, resident memory, heap and start time. It answers only callers holding the internal token (`404` otherwise) and the gateway has no route to it; scrape each service on its internal address with `x-betng-internal-token`.

## Server options

`createServiceServer` takes `maxBodyBytes` (adapter cap, default 256 KiB), `trustProxy` (which peers may set `x-forwarded-for`) and `shutdownGraceMs`. `createServiceClient` sends `rawBody` byte for byte instead of JSON when a caller must not re-serialise. `createWebSocketAdapter` takes `maxConnectionsPerAddress`, `addressOf` and `maxFrameBytes` (default 4 KiB). `createIpMatcher` and `canonicalIp` match addresses against IPv4/IPv6 CIDR lists.
