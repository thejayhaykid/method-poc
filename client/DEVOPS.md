# MANTL x-darwin DevOps & Local Development Guide

## Table of Contents

- [Repository Overview](#repository-overview)
- [Local Development](#local-development)
- [Turborepo Build System](#turborepo-build-system)
- [Docker](#docker)
- [CI/CD Pipeline](#cicd-pipeline)
- [Kubernetes & Helm](#kubernetes--helm)
- [Ephemeral Environments](#ephemeral-environments)
- [Secrets & Configuration](#secrets--configuration)
- [Service Communication](#service-communication)
- [Database & Migrations](#database--migrations)
- [Testing Infrastructure](#testing-infrastructure)
- [Release Process](#release-process)
- [Observability](#observability)

---

## Repository Overview

MANTL is a TypeScript monorepo managed with **Turborepo** and **pnpm workspaces**.

| Property | Value |
|---|---|
| Package manager | pnpm 10.28.2 (enforced via `preinstall` script) |
| Node version | 22 (pinned in `.nvmrc` and `engines`) |
| Build orchestrator | Turborepo |
| Workspace roots | `packages/*`, `src/*` |
| Services | ~42 in `src/` |
| Shared packages | ~29 in `packages/` |

### Workspace Layout

```
x-darwin/
├── packages/           # Shared libraries (@mantl/domain, @mantl/nest-core, @mantl/config, etc.)
├── src/                # Microservices and applications
│   ├── console-web/    # React/Next.js admin frontend (Relay + PandaCSS)
│   ├── console-api/    # GraphQL BFF aggregating data from microservices
│   ├── application-service/
│   ├── core-wrapper-service/
│   ├── outbox-service/
│   └── ... (~40 more services)
├── docker/             # Dockerfiles and build configs
├── helm-shared/        # Shared Helm chart templates
├── .buildkite/         # Buildkite pipeline definitions
├── .github/            # GitHub Actions workflows
├── scripts/            # Utility scripts
├── tools/              # AI skills, JIRA tools
├── turbo.json          # Turborepo task pipeline
├── pnpm-workspace.yaml # Workspace + version catalog (~480 pinned deps)
└── package.json        # Root scripts
```

### Key Root Files

| File | Purpose |
|---|---|
| `turbo.json` | Task pipeline, caching, global env passthrough |
| `pnpm-workspace.yaml` | Workspace definition + centralized version catalog |
| `tsconfig.base.json` | Shared TypeScript config (composite, strict, CommonJS) |
| `eslint.config.js` | Root ESLint flat config |
| `.prettierrc.js` | Prettier config |
| `lint-staged.config.js` | Pre-commit: ESLint auto-fix on staged files |
| `force_build.txt` | Increment to invalidate all Turbo caches globally |
| `.nvmrc` | Pins Node 22 |
| `.npmrc` | `save-exact=true`, `strict-peer-dependencies=false` |

---

## Local Development

### Prerequisites

- Node 22 (use nvm: `nvm use`)
- pnpm 10 (`corepack enable`)
- Docker Desktop running
- Vault token at `~/.vault-token` (for fetching secrets)

### Quick Start Commands

| Command | What It Does |
|---|---|
| `pnpm dev:conf` | Start **console subset** (console-web, console-api, client-service) |
| `pnpm dev` | Start **all ~40 services** |
| `pnpm dev:reset` | Full reset: stop services, wipe postgres & elasticsearch, pull fresh Docker images |
| `pnpm dev:reset:nopull` | Reset without pulling fresh images |

### What Happens When You Run `pnpm dev:conf`

The `dev:conf` script triggers `dev:run` with a service filter:

```
pnpm dev:run --filter=@mantl/{console-web,console-api,client-service}
```

`dev:run` executes this chain:

```
./kill_zombie_pm2.sh       # 1. Kill orphaned PM2 node processes
  && pnpm install          # 2. Ensure all dependencies are current
  && pnpm --filter @mantl/tooling start-backbone-dependencies  # 3. Docker Compose up
  && turbo run dev         # 4. Turborepo orchestrates the full startup
```

### Step 3: Docker Compose Backbone

The `start-backbone-dependencies` script runs:

```bash
docker compose --profile local-only -f docker-compose.turborepo.yml up -d --wait
```

This starts all infrastructure services and waits for their health checks:

| Service | Image | Local Port | Health Check |
|---|---|---|---|
| PostgreSQL 14 | `postgres:14` | 5432 | `pg_isready` |
| Redis | `redis` | 6379 | `redis-cli --raw incr ping` |
| Elasticsearch 8.17 | `elasticsearch:8.17.1` | 9200 | `curl /_cat/health` |
| Zookeeper | `ubuntu/zookeeper` | 2181 | TCP ruok |
| Kafka Broker | `ubuntu/kafka` | 29092 | `kafka-topics.sh --list` |
| Kafka UI | `provectuslabs/kafka-ui` | 8080 | — |
| Nginx | `nginx` | 80, 9090 | — |
| ClamAV Scanner | custom image | 8087 | — (local-only profile) |

**PostgreSQL** uses `wal_level=logical` for the outbox service's logical replication. A database snapshot (`packages/tooling/postgres-init/db.out`) is loaded on first startup so you don't need to wait for all migrations.

**Kafka** runs with a single broker on `broker:29092` with `offsets.topic.replication.factor=1`.

The Docker Compose file lives at `packages/tooling/docker-compose.turborepo.yml`.

### Step 4: Turborepo `dev` Task

Turborepo resolves the full dependency graph for the `dev` task:

```
dev:stop          → Kill previously running PM2 processes
  ↓
^build            → Build all dependency packages (nest-core, config, domain, etc.)
  ↓
vault-pull        → Fetch secrets from HashiCorp Vault → writes secrets.json per service
  ↓
create-db         → Create PostgreSQL databases/schemas for each service
  ↓
migrate           → Run TypeORM/Knex migrations
  ↓
seed              → Seed initial data
  ↓
build:graphql-types → Generate GraphQL type definitions
gen:dev-config      → Generate development config files
build:deps          → Build service-specific dependencies
  ↓
dev (per service) → Start the service via PM2
```

### PM2 Process Management

Each service defines a `pm2.config.js` that specifies how to run locally. Services run natively on the host (not in Docker) using `ts-node` with `--watch` for hot-reloading and `--inspect` for debugging.

Example ports:

| Service | Port | Debug Port |
|---|---|---|
| console-web | 30005 | 9337, 9383 |
| console-api (API) | 28005 | 9335 |
| console-api (realtime WS) | 31005 | 9342 |
| application-service | 50065 | 9400 |

**console-web** also runs two sidecar processes via PM2:
- `relay-compiler --watch` — regenerates Relay GraphQL artifacts
- `panda --watch` — regenerates PandaCSS style tokens

### Tooling Package Utilities

The `@mantl/tooling` package (`packages/tooling/`) provides these scripts:

| Script | Purpose |
|---|---|
| `start-backbone-dependencies` | `docker compose up -d --wait` |
| `postgres:reset` | Stop and remove postgres container + volumes |
| `postgres:dump` | Dump all databases to `postgres-init/db.out` |
| `elasticsearch:reset` | Stop and remove elasticsearch container + volumes |
| `pull-fresh-images` | Pull latest Docker images |

### Zombie Process Cleanup

Two scripts handle orphaned processes:

- `kill_zombie_pm2.sh` — Finds node processes with `pm2-managed` in their command that are no longer tracked by PM2's process list, and kills them.
- `kill_zombie_node_dev.sh` — Kills orphaned node-dev processes (skips in CI environments).

### Nginx Reverse Proxy

A local nginx container proxies requests using the config at `packages/tooling/src/nginx/nginx.conf`, routing traffic between the frontend and backend services running on the host via `host.docker.internal`.

---

## Turborepo Build System

### Configuration (`turbo.json`)

The pipeline defines task dependencies, caching, and environment passthrough.

**Global dependencies** (changes to these invalidate ALL caches):
- `docker/Dockerfile`
- `tsconfig.base.json`
- `.github/workflows/turbo-tests.yml`
- `force_build.txt`

**Key task definitions:**

| Task | Cached | Dependencies |
|---|---|---|
| `build` | Yes (`dist/**`) | `^build`, `build:deps`, `build:graphql-types`, `gen:dev-config` |
| `type-check` | Yes | `^build`, `build:graphql-types`, `gen:dev-config`, `build:deps` |
| `test:ci` | Yes | `^build`, `create-db`, `migrate`, `seed`, `vault-pull`, `build:graphql-types`, `gen:dev-config`, `build:deps` |
| `dev` | No | `dev:stop`, `^build`, `create-db`, `migrate`, `seed`, `vault-pull`, `build:graphql-types`, `gen:dev-config`, `build:deps` |
| `create-db` | No | `@mantl/config#build`, `@mantl/nest-core#build`, `vault-pull` |
| `migrate` | No | `create-db`, `vault-pull`, package builds |
| `seed` | No | `migrate`, `vault-pull`, package builds |
| `vault-pull` | No | — |

**Service-level turbo.json overrides** exist for:
`console-api`, `console-web`, `console-web-sb`, `core-wrapper-service`, `self-serve`, `web-automation`, `pdf-rollup`, `self-serve-components`

### Build Outputs

| Component | Build Tool | Output |
|---|---|---|
| NestJS services | `tsc --build` | `dist/` |
| Shared packages | `tsc --build` | `dist/` |
| console-web | SWC + Next.js | `dist/` + `.next/` |
| Relay compiler | `relay-compiler` | `lib/__generated__/` |
| PandaCSS | `panda codegen` | `styled-system/` |

### Dependency Catalog

`pnpm-workspace.yaml` contains a centralized version catalog with ~480 pinned dependencies. Individual `package.json` files reference versions with `"catalog:"` instead of hardcoded version strings, ensuring consistency across the monorepo.

---

## Docker

### Multi-Stage Dockerfile (`docker/Dockerfile`)

A single parameterized Dockerfile builds all backend services:

```
Stage 1: vault_base    — HashiCorp Vault 1.20 binary source
Stage 2: node_base     — Node 22-slim + Vault CLI + system deps + corepack
Stage 3: build         — Full monorepo copy → pnpm install → turbo build → turbo prune
Stage 4: release       — Pruned workspace only → production install → conditional Puppeteer
```

The `SERVICE_NAME` build arg controls which service is built. `turbo prune --scope=@mantl/$SERVICE_NAME` creates a minimal workspace in `/opt/app/out` containing only the target service and its transitive dependencies.

A conditional block installs Chromium/Puppeteer dependencies only if `packages/pdf-rollup` is present in the pruned output (for services that generate PDFs).

**Image naming convention:**
```
us-central1-docker.pkg.dev/managed-infrastructure/development/darwin-{service-name}:{tag}
```

Three tags per image: `:latest`, `:{git-short-sha}`, `:{turbo-content-hash}`

### web-automation Dockerfile (`docker/src/web-automation/Dockerfile`)

A separate Dockerfile for the web-automation service that pre-installs Chromium, FFmpeg, and CJK fonts for browser testing.

### `.dockerignore`

Excludes `.git`, `node_modules`, `dist/`, coverage reports, and build artifacts. Notably includes `!packages/client-config/dist/clientConfig.json` to preserve the client config.

### Why Dockerfiles Are in `docker/`

From `docker/README.md`: Dockerfiles are isolated from service source directories to preserve Docker layer caching. Changes to a Dockerfile don't invalidate the source code cache layers.

---

## CI/CD Pipeline

### Overview

CI/CD is split across two systems:

| System | Responsibilities |
|---|---|
| **GitHub Actions** | Tests, type-checking, linting, security scans, release management |
| **Buildkite** | Docker image builds, Kubernetes deployments, ephemeral environments |

### GitHub Actions Workflows

#### `turbo-tests.yml` — Main Test Pipeline

**Triggers:** PRs to `integration`/`main`, pushes to `integration`

**Jobs:**

1. **determine-packages** — Uses `turbo --dry-run` with git diff filter to compute which packages changed and need testing.

2. **type-check** — `turbo run type-check` filtered to changed packages.

3. **lint** — `turbo run lint:ci` filtered to changed packages.

4. **test** — Matrix job over changed services. Each matrix entry:
   - Starts Docker Compose (postgres, redis, elasticsearch, kafka)
   - Adds host aliases (`127.0.0.1 postgres broker redis elastic-stack`)
   - Runs `turbo run test:ci --filter=@mantl/{service}`
   - Uploads coverage to Codecov

5. **core-wrapper-test** — Special matrix of 32 adapter paths for the core-wrapper-service, each tested independently.

6. **test-summary / core-wrapper-test-summary** — Gate jobs that fail if any matrix job failed.

**Turbo cache strategy:** Branch-aware cache keys with fallback:
```
turbo-{job}-{base_ref}-{head_ref}-{sha}
turbo-{job}-{base_ref}-{head_ref}
turbo-{job}-{base_ref}
```

#### Other Workflows

| Workflow | Purpose |
|---|---|
| `release.yml` | Extract JIRA issues from commits, update release fields, draft Zendesk changelog, notify Slack |
| `create-release-pr.yml` | Auto-create release PRs Mon & Wed at 9am ET |
| `db-snapshot.yml` | Auto-update `postgres-init/db.out` when migration/seed files change on `integration` |
| `client-config.yml` | Validate client config lock files on PRs |
| `polaris-incremental.yaml` | Incremental SAST/SCA on changed services |
| `polaris-release.yaml` | Full SAST/SCA scan on tag push |
| `codeql-analysis.yml` | GitHub CodeQL security analysis |
| `check-approvals.yml` | Require all requested reviewers to approve |
| `jira-transition.yml` | Auto-transition JIRA issues (PR opened → "In Review", merged → "Released to INT") |
| `jira-association.yml` | Associate PRs with JIRA tickets |
| `labeler.yml` | Auto-label PRs based on files changed |
| `cleanup-config-versions.yml` | Clean up old client config versions after production deploy |
| `eph-weekly-report.yml` | Weekly ephemeral environment usage report |

### Buildkite Pipeline

The main pipeline generator is `.buildkite/x-darwin-mono/pipeline.sh`.

**Environment routing:**

| Branch | Environments |
|---|---|
| PR branches | ephemeral |
| `integration` | integration |
| `main` | uat → production → demo |
| `hotfix/*` | production → demo |

**Pipeline phases:**

1. **Ephemeral backbone** (PR only) — Deploy postgres, kafka, redis, ES, vault to ephemeral k8s namespace
2. **Build group** — For each service with a `stack/k8s/{env}/` directory:
   - Check if a Turbo-content-hashed image already exists in Artifact Registry (skip if so)
   - Submit build to Google Cloud Build if needed
   - Run Sysdig vulnerability scan (UAT/production)
3. **Deploy group** (per environment):
   - Production/demo: manual `block` step (human promotion gate)
   - Run `kubernetes_deploy.sh` per service
   - Post-deploy actions

**Smart rebuild avoidance:** `turbo_hash_existing_image.sh` checks if an image with the Turbo content hash already exists. If the source code hasn't changed, the build is skipped entirely.

### Google Cloud Build (`docker/cloudbuild.yaml`)

- 40-minute timeout
- Runs on `buildkite-pool-standard4` worker pool
- Node max heap: 24GB
- Secrets encrypted via Google Cloud KMS (`mantl-buildkite-keyring`)
- Single build step: `docker build` with `--cache-from` and `--target release`

### Security Scanning (`docker/sysdig.yaml`)

Post-build Sysdig CLI scanner runs against the `mantl-pipeline-policy` on `us2.app.sysdig.com`.

---

## Kubernetes & Helm

### Shared Helm Chart (`helm-shared/`)

A shared chart provides common templates for all services:

| Template | Purpose |
|---|---|
| `deployment.yaml` | Full deployment with Vault sidecar, init containers, probes, anti-affinity |
| `service.yaml` | ClusterIP service |
| `ingress.yaml` | Nginx ingress with ephemeral URL support |
| `poddisruptionbudget.yaml` | PDB configuration |
| `serviceaccount.yaml` | K8s service account |
| `cronjob.yaml` | CronJob support |

### Pod Architecture (Non-Ephemeral)

```
Pod
├── Init Container: vault-login     # vault-auth k8s-login
├── Sidecar: vault-auto-renew       # Continuously renews Vault token
└── Main Container: {service}       # The application
    ├── Startup Probe
    ├── Liveness Probe
    └── Environment Variables (PORT, VAULT_*, DD_*, custom env)
```

### Pod Architecture (Ephemeral)

```
Pod
└── Main Container: {service}       # Uses static VAULT_TOKEN, no sidecar needed
```

### Per-Service Helm Values

Each service has 6 Helm values files:

```
src/{service}/helm/
├── values-stable-envs.yaml     # Base config for non-ephemeral environments
├── values-ephemeral.yaml       # PR/ephemeral environment
├── values-integration.yaml     # Integration overrides
├── values-uat.yaml             # UAT overrides
├── values-production.yaml      # Production overrides
└── values-demo.yaml            # Demo overrides
```

**Resource defaults:**
```yaml
resources:
  limits:   { memory: "4Gi", cpu: "1" }
  requests: { memory: "1Gi", cpu: "250m" }
```

Production services typically run 3 replicas with higher resource limits.

### K8s Clusters

| Environment | Cluster | Namespace | Manifest Method |
|---|---|---|---|
| Ephemeral | `development-ephemeral` | `x-darwin-{PR#}` | Helm (`helm-shared`) |
| Integration | `integration` | `x-darwin` | `mantl-stack` (legacy) |
| UAT | `uat` | `x-darwin` | `mantl-stack` (legacy) |
| Production | `production` | `x-darwin` | `mantl-stack` (legacy) |
| Demo | `production` | `x-darwin-demo` | `mantl-stack` (legacy) |

### K8s Startup Commands

Services have different startup chains depending on environment:

**Stable environments (`start:k8s`):**
```
vault-pull → migrate:k8s → seed:k8s → start
```

**Ephemeral environments (`start:k8s:eph`):**
```
vault-pull → create:db:k8s → create:db:pub:k8s → migrate:k8s → seed:k8s → start
```

Ephemeral startup includes database and publication creation since each PR gets a fresh namespace.

---

## Ephemeral Environments

Every PR automatically gets a full isolated environment deployed to Kubernetes.

### What Gets Deployed

Each ephemeral environment (`x-darwin-{PR#}` namespace) includes:

**Backbone services** (deployed via raw k8s manifests in `.buildkite/ephemeral/manifests/`):
- PostgreSQL with persistent volume
- Redis
- Elasticsearch with persistent volume
- Kafka broker + Zookeeper
- Kafka UI
- Vault server (local, with plaintext root token)
- Firestore emulator
- ClamAV document scanner

**Application services** — All services with a `stack/k8s/ephemeral/` directory are built and deployed.

### URL Pattern

```
https://{service}-{PR#}.eph.mantl.dev
```

Example: PR #456 → `https://console-456.eph.mantl.dev`

### Smart Skip Logic

The ephemeral pipeline (`pipeline-build-and-test.sh`) checks if changes are only in core-wrapper adapter modules. If so, ephemeral deployment is skipped since adapter changes don't need a full environment.

### Lifecycle

1. PR opened → Buildkite triggers ephemeral pipeline
2. Backbone services deployed to `x-darwin-{PR#}` namespace
3. Vault secrets synced from main Vault
4. All service images built and deployed
5. E2E tests run against the environment
6. **Keep-alive block** — developers can prevent auto-idling (default: 8 hours)
7. Environments are automatically idled after inactivity

---

## Secrets & Configuration

### HashiCorp Vault

All secrets are managed through Vault. The integration varies by environment:

| Environment | Vault Address | Auth Method |
|---|---|---|
| Local dev | `https://vault.mantl.team` (via proxy) | Token from `~/.vault-token` |
| Ephemeral | `http://vault-server:8200` (in-cluster) | Static plaintext token |
| Integration/UAT/Prod | `http://vault.es.mantl.internal` | K8s service account + sidecar renewal |

### `vault-pull` Flow

Each service has a `vault-pull` npm script that:
1. Authenticates with Vault using the team and config path
2. Downloads secrets
3. Writes them to `secrets.json` in the service root

Different services use different Vault teams and config paths:

| Service | Vault Team | Config Path |
|---|---|---|
| console-api | `ac` | `darwin/default_config` |
| console-web | `ac` | `darwin/service/console-web/default_config` |
| application-service | `mantl_system` | `services/application-service/default_config` |

### Config Loading (`@mantl/config`)

Config is loaded in this priority order (later overrides earlier):

1. `config.default.js` — Static defaults (checked in)
2. `config.js` — Vault-generated (from `secrets.json`)
3. `config.local.js` — Developer overrides (gitignored)
4. Environment variables

Each service's `config.default.js` follows this pattern:
```javascript
const config = { LOG_LEVEL: 'silly' }
let secrets = {}
try { secrets = require('./secrets.json') } catch { /* skip in dev */ }
module.exports = { ...config, ...secrets, ...process.env }
```

### Turbo Environment Passthrough

These environment variables are passed through to all Turborepo tasks:
```
CLOUDFLARE_ACCESS_CLIENT_ID, CLOUDFLARE_ACCESS_CLIENT_SECRET,
DD_API_KEY, DD_SERVICE, DD_SITE,
MANTL_ENV, NODE_ENV, NPM_TOKEN,
VAULT_ADDR, VAULT_ENV, VAULT_HTTP_PROXY, VAULT_TOKEN
```

---

## Service Communication

### Kafka (Primary Event Bus)

18 services register as Kafka consumers via NestJS `Transport.KAFKA`. The message format uses canonical event envelopes.

**92 Kafka topics** are defined in `packages/nest-core/src/kafka/constants.ts`, organized by domain:
- `account.*`, `application.*`, `document.*`, `person.*`, `organization.*`
- `funding-transaction.*`, `indication-of-interest.*`, `kyc*`, `checkbook*`
- `system-events`, `system-errors`, `reindex`
- Various webhook capture topics

**CDC (Change Data Capture):** `KafkaEntitySubscriber` is a TypeORM `EventSubscriber` that automatically publishes Kafka events on entity insert/update/delete. It buffers messages per-transaction and only emits after commit. Events include full entity snapshots and diffs.

**Outbox Pattern:** Services write to an `outbox` table within the same database transaction. The `outbox-service` reads these via PostgreSQL logical replication (primary) or polling (fallback) and publishes them to Kafka. This guarantees at-least-once delivery.

### HTTP Transport

`@mantl/transport-http-client` provides 30+ NestJS dynamic modules wrapping Axios for synchronous inter-service HTTP calls (e.g., `ApplicationHttpModule`, `PersonHttpModule`, `CoreWrapperHttpModule`).

### GraphQL (console-api BFF)

`console-api` serves as the Backend-For-Frontend using `graphql-http` (not Apollo Server). The schema is ~13,000 lines. WebSocket subscriptions run in a separate Node.js process (`realtime-next`) using `graphql-ws`.

`console-web` uses **Relay 20** as the GraphQL client with code generation from the console-api schema.

### BullMQ

Task queues for background jobs, integrated via `@mantl/nest-core/src/bullmq/`.

---

## Database & Migrations

### Two Migration Systems

| System | Used By | Migration Dir | Count |
|---|---|---|---|
| **TypeORM** | All NestJS services | `db/migrations/` | ~70 per service |
| **Knex** | console-api only | `src/_configuration/migrations/tables/` | ~114 tables |

### TypeORM ORM Config Pattern

Each service has an `ormconfig.ts`:
```typescript
const options: DataSourceOptions = {
  type: 'postgres',
  host: config.POSTGRES_HOST,
  schema: config.POSTGRES_SCHEMA,
  entities: [path.join(__dirname, 'src/**/*.entity.{js,ts}'), Outbox],
  migrations: [path.join(__dirname, 'db/migrations/**/*.{js,ts}')],
  migrationsTransactionMode: 'each',
  synchronize: false,
  uuidExtension: 'pgcrypto',
}
```

Every service that uses the outbox pattern includes the shared `Outbox` entity from `@mantl/nest-core`.

### Database DevOps CLI (`packages/nest-core/src/devops.ts`)

| Command | Purpose |
|---|---|
| `createDb` | Create database + schema if not exists |
| `dropDb` | Drop schema CASCADE |
| `createPublicationK8s` | Create PostgreSQL logical replication publication for outbox |

### DB Snapshot Automation

The `db-snapshot.yml` GitHub Action detects changes to migration/seed files on `integration`. When changes are found, it:
1. Starts Docker Compose
2. Runs all migrations and seeds
3. Dumps the database to `packages/tooling/postgres-init/db.out`
4. Auto-commits the snapshot back to `integration`

This snapshot is loaded on local `docker compose up`, so developers get a pre-migrated database instantly.

---

## Testing Infrastructure

### Jest Configuration

Shared Jest config from `@mantl/tooling`:
- **Test environment:** Node
- **Timeout:** 90 seconds
- **Transform:** `@swc/jest` (fast TypeScript compilation with decorator support)
- **Test pattern:** `*.spec.ts`

console-web uses a separate config with `next/jest`, React Testing Library, and identity-obj-proxy for CSS modules.

### Test Types

| Script | Purpose |
|---|---|
| `test` | Unit tests (local dev) |
| `test:ci` | Full CI with coverage, silent logging, 4GB heap |
| `test:surface` | Integration tests (requires vault, DB, Kafka running) |
| `test:e2e` | End-to-end tests (separate jest config) |
| `test:watch` | Dev watch mode |
| `test:debug` | Debug with `--inspect-brk --runInBand` |

### CI Test Matrix

The CI pipeline dynamically determines which packages need testing using:
```bash
turbo run --dry-run=json --filter="...[HEAD^1...HEAD]" test:ci
```

Each changed service runs in its own matrix job with a fresh Docker Compose stack.

The core-wrapper-service has a special 32-entry matrix (one per banking adapter) to parallelize its large test suite.

### Coverage

Codecov is configured with:
- Branch target: `integration`
- Informational-only patch coverage (won't block PRs)
- 30 individual component flags for core-wrapper adapters
- Carryforward enabled (except outbox-service)

---

## Release Process

### Branch Strategy

```
feature branches → integration → main → production tags
                        ↓
                   ephemeral envs
```

### Release Cadence

1. **Automated release PRs** are created Mon & Wed at 9am ET via `create-release-pr.yml`
2. PR creates `release/{timestamp}` branch from `integration`, targeting `main`
3. Auto-merge is enabled on the PR
4. On merge to `main`:
   - `release.yml` extracts JIRA issues, updates release numbers, drafts Zendesk changelog
   - Buildkite deploys to UAT automatically
   - Production and Demo require manual promotion (Buildkite block step)
   - Slack notification to `#deployments`
   - Production deploy creates a git tag

### Hotfix Path

Branches prefixed with `hotfix/*` deploy directly to production and demo, bypassing integration and UAT.

### JIRA Integration

- PR opened → JIRA "In Review" transition
- PR merged to `integration` → JIRA "Released to INT" transition
- Release PR → JIRA "Release Number(s)" field updated

---

## Observability

| Concern | Tool |
|---|---|
| APM / Tracing | Datadog (`dd-trace`, initialized via `@mantl/node/datadog`) |
| Browser RUM | Datadog Browser RUM + Logs |
| Logging | Winston (`@mantl/nest-logger`) with Datadog logs injection |
| Runtime Metrics | Datadog runtime metrics |
| Feature Flags | LaunchDarkly (`@mantl/rollout-flags-server`) |
| Error Tracking | Datadog + custom `AllExceptionsFilter` |

In production, every pod has these Datadog environment variables:
```
DD_SERVICE, DD_ENV, DD_VERSION, DD_LOGS_INJECTION=true,
DD_RUNTIME_METRICS_ENABLED=true, DD_DOGSTATSD_PORT, DD_AGENT_HOST
```

---

## Code Quality

### Git Hooks

Pre-commit hook (via Husky) runs `lint-staged`:
```
*.{js,cjs,mjs,ts,jsx,tsx,json} → eslint --fix
```

### CODEOWNERS

Key ownership rules:
- `/docker`, `/.github`, `/.buildkite`, `/pnpm-lock.yaml` → `@myfintech/techleads`
- `src/core-wrapper-service` → `@myfintech/core-wrapper-reviewers`
- `src/console-web/src/UI` → `@myfintech/component-library-reviewers`
- `/packages/tooling/postgres-init/` → `@mantljosh`
- Application booking execution files → `@myfintech/application-booking-reviewers`

### Dependabot

Weekly npm dependency updates with a limit of 5 open PRs, using the private NPM registry.

### Security

- Polaris SAST/SCA on every PR (incremental) and every tag (full)
- GitHub CodeQL analysis
- Sysdig container scanning on UAT/production builds
- ~50 security-related dependency overrides in `pnpm-workspace.yaml`

---

## Quick Reference

### Common Commands

```bash
# Start console services locally
pnpm dev:conf

# Start all services locally
pnpm dev

# Full local reset
pnpm dev:reset

# Build all packages
pnpm turbo build

# Type-check everything
pnpm type-check

# Lint everything
pnpm lint

# Run tests for a specific service
pnpm --filter @mantl/console-api test
pnpm --filter @mantl/application-service test

# Run a single test file
pnpm --filter @mantl/console-api test -- path/to/file.spec.ts

# Build a specific package
pnpm turbo --filter=@mantl/client-config build

# Database operations
pnpm --filter @mantl/console-api migrate
pnpm --filter @mantl/console-api seed

# Scaffold a new service
pnpm generate

# Kill all node/pnpm processes
pnpm close-files

# Nuclear option: remove all node_modules and reinstall
pnpm nuke
```

### Local Service URLs

| Service | URL |
|---|---|
| Console Web | http://console.mantl.localhost (via nginx) or http://localhost:30005 |
| Console API GraphQL | http://localhost:28005/graphql |
| Console API Health | http://localhost:28005/api/health |
| Kafka UI | http://localhost:8080 |
| Elasticsearch | http://localhost:9200 |
| PostgreSQL | `postgresql://mantl:mantl@localhost:5432/mantl` |
| Redis | `redis://localhost:6379` |
