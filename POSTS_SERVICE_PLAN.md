# Posts Service Implementation Plan

This document outlines the steps to introduce a `posts-service` consistent with existing Go microservices (user, auth, chat) while addressing observed gaps for smoother development and operations.

## 1. Repository Structure and Bootstrapping
- **Directory**: create `posts_service/` mirroring `auth_service` or `chat_service` layout (cmd, internal/pkg, migrations, proto, Dockerfile, Makefile, README).
- **Base template**: copy the shared scaffolding (config loader, logger, app runner, DB helper, migrations wiring) from the most up-to-date existing service to ensure consistency; avoid duplicating outdated patterns (see Section 7).

## 2. Proto & Generated Code
- **Place proto**: `posts_service/proto/posts/v1/posts.proto` with the provided schema.
- **go.mod**: initialize module (e.g., `github.com/MentorPlatform/posts_service`), set Go version consistent with other services.
- **Generation**: add `make proto` target that runs `buf generate` or `protoc` with `--go_out` and `--go-grpc_out` matching other services; commit generated `*.pb.go` (as existing repos commit generated code) unless you decide to switch all services to codegen on build in a follow-up.

## 3. Database Schema & Migrations
- **DB choice**: PostgreSQL (align with other services). Add a dedicated DB service in `docker-compose.yaml` (e.g., `posts_db`) with its own volume and env variables.
- **Tables**:
  - `posts`: id (UUID PK), author_id (UUID, FK to user-service if/when cross-service validation is added), title (text), content (text), tags (text[]), status (smallint), created_at/updated_at (timestamptz), maybe `search_vector` (tsvector) for full-text search.
  - `post_ratings`: id (UUID PK), post_id (UUID FK), rater_id (UUID optional), rate (int), comment (text), created_at.
- **Indexes**: composite indexes for author_id+status, GIN on tags, GIN or GIST on search vector; index on updated_at for sorting.
- **Migrations**: add `migrations/0001_init.sql` with schema and triggers to auto-update `updated_at`; add `Makefile` target `make migrate` using the same tooling as other services.

## 4. Configuration
- **Config file/env**: follow existing pattern (`configs/config.yaml` + env overrides). Add fields for DB DSN, HTTP/gRPC ports, auth/jwt public key path (for auth validation), pagination defaults, and rate limits.
- **Dockerfile**: multi-stage build similar to other services.
- **Entrypoint**: main binary should parse config, init logger, connect to DB, run migrations (if that pattern is already used), start gRPC + optional HTTP gateway.

## 5. Service Logic & API Surface
- **Transport**: expose gRPC as defined; optionally provide REST via grpc-gateway/swagger in `api_gateway` (update gateway proto + config later).
- **Handlers**:
  - `CreatePost`: validate input (title/content non-empty, status defaults to DRAFT), insert row, return created entity.
  - `GetPost`: fetch by id, 404 if missing.
  - `UpdatePost`: apply `FieldMask`; restrict mutable fields (title, content, tags, status); enforce transitions (e.g., ARCHIVED cannot go back to DRAFT if that’s a rule you want).
  - `DeletePost`: soft delete? If consistent with other services, use hard delete; document choice.
  - `RatePost`: upsert/insert rating; consider per-user single rating; recompute aggregate rating if needed (could be returned in Post later).
  - `ListPosts`: implement pagination (page_size/page_token), filters (author_id, status, tags, search_query), sorting (field + order). Return `total_count` if not too expensive; otherwise document that it may be approximate or disabled.
- **Data mapping**: centralized converter between DB models and proto messages; store status as smallint, tags as text[]; manage timestamps with UTC.

## 6. Validation, Errors, AuthZ
- **Validation**: use validator library (same as other services). Enforce max lengths on title/content/tags to prevent abuse.
- **Error model**: follow existing services’ gRPC status codes and error wrappers. Avoid leaking internal SQL errors; map to NotFound/InvalidArgument/AlreadyExists, etc.
- **Auth**: verify JWT via auth-service public key (if pattern exists). Enforce that `author_id` matches the authenticated user on create/update/delete; allow public read for published posts if business rules permit.
- **Rate limiting**: optionally add middleware (if other services use it) to protect writes.

## 7. Observed Gaps to Avoid Repeating
- Ensure `updated_at` is set via triggers or code; some existing services may not do this consistently.
- Standardize pagination tokens (e.g., base64 cursor) instead of offset/limit to avoid drift between services.
- Centralize migrations running: avoid ad-hoc SQL in code; rely on the migration tool.
- Add unit tests for repository + service layers; other services may lack coverage.
- Keep proto enums aligned with DB constraints to prevent mismatched states.

## 8. Testing
- **Unit tests**: for repository (CRUD/filtering) using test DB container; for service handlers with mocked repository.
- **Integration**: docker-compose up end-to-end, hitting gRPC endpoints (or REST via gateway) with seeded data.

## 9. API Gateway & CI/CD follow-up
- Update `api_gateway` proto/gateway config to expose posts endpoints; regenerate gateway stubs.
- Add posts-service to CI (lint, tests) similar to other services’ pipelines.
- Wire docker-compose to include posts-service (build context, env, ports) so local dev works with one command.

## 10. Documentation
- Add README in `posts_service/` with setup/run instructions, env vars, migration commands, proto regen, and example requests.
- Update root `GETTING_STARTED.md` to include posts-service in the stack once implemented.
