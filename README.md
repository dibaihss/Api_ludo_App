# Strategic Ludo Game Backend (Node.js)

REST API backend for Strategic Ludo with user management, authentication, and game session management.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (LTS) |
| Language | JavaScript (CommonJS) |
| API Framework | Express.js |
| Database | PostgreSQL |
| Query Builder | Knex.js |
| Authentication | JWT (`jsonwebtoken`) |
| Password Hashing | `bcrypt` |
| Validation | `express-validator` |
| Environment | `dotenv` |
| Cloud Host Additions | Azure Functions config (`host.json`, `local.settings.json`, `.funcignore`) |

---

## Prerequisites

- Node.js 18+
- PostgreSQL (Supabase or local)
- Azure Functions Core Tools v4 (only needed for Azure Functions workflows)

---

## Installation

```bash
npm install
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
PORT=3000
# Preferred for Supabase
DATABASE_URL=postgresql://postgres.your-project-ref:your-db-password@aws-0-region.pooler.supabase.com:6543/postgres

# Fallback (supported for backward compatibility)
DB_HOST=aws-0-region.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.your-project-ref
DB_PASSWORD=your-db-password
DB_SSL=true
RESET_DB_ON_START=false
SESSION_CREATE_WINDOW_MS=600000
SESSION_CREATE_MAX_PER_USER=3
SESSION_CREATE_MAX_PER_IP=5
SESSION_ACTIVE_CAP_REGISTERED=3
SESSION_ACTIVE_CAP_GUEST=1
SESSION_TTL_WAITING_MINUTES=30
SESSION_TTL_IN_PROGRESS_MINUTES=240
SESSION_CLEANUP_INTERVAL_MS=600000
JWT_SECRET=your-super-secret-jwt-key
```

If your password has special characters (like `#`, `@`, `:`), URL-encode it in `DATABASE_URL`.
Set `RESET_DB_ON_START=true` only in development to drop all migrated tables and recreate them on every server restart.
Session anti-spam defaults are tuned for small databases and can be adjusted using the `SESSION_*` values above.

For Azure Functions local runtime, `local.settings.json` already includes:

```json
{
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true"
  }
}
```

---

## Database Migrations

```bash
npm run migrate
npm run migrate:rollback
```

---

## Run Commands

```bash
npm run dev      # Development (nodemon)
npm start        # Start Express server
npm test         # Run unit tests
npm run test:unit
npm run test:integration
npm run test:integration:local  # Run integration tests against local Docker Postgres
```

If the configured PostgreSQL instance is unreachable during a local interactive `npm start` or `npm run dev`, the server now offers to start a disposable Docker PostgreSQL container for that run and automatically applies migrations before listening.

Local integration tests use `docker-compose.integration.yml` and run with automatic setup/teardown through:

```bash
npm run test:integration:local
```

---

## Testing and CI

### Unit tests

- Framework: Jest
- Location: `__tests__/` (excluding `__tests__/integration`)
- Coverage includes:
  - guest login JWT response
  - session create cap checks
  - session create rate limiter

### Integration tests (real DB)

- Location: `__tests__/integration/**/*.test.js`
- Uses real PostgreSQL queries via Knex
- Current integration coverage includes:
  - session model lifecycle and cleanup
  - guest login API (`POST /api/guest-login`) response + DB persistence checks

### Local integration test command

`npm run test:integration:local` will:

1. Start `postgres:16` from `docker-compose.integration.yml` on port `5433`
2. Wait for health check
3. Run `npm run migrate:test`
4. Run `npm run test:integration`
5. Tear down container and volume

Note: On Windows, Docker access may require running terminal as Administrator or ensuring Docker Desktop permissions are available.

### GitHub Actions

- Workflow file: `.github/workflows/ci.yml`
- Jobs:
  - `unit-tests`: install deps + run `npm run test:unit`
  - `integration-tests`: start PostgreSQL service container, run `npm run migrate:test`, then `npm run test:integration`

---

## Azure Functions Additions

The project now includes base Azure Functions configuration files:

- `host.json`: Azure Functions host + extension bundle configuration
- `local.settings.json`: local runtime settings (`FUNCTIONS_WORKER_RUNTIME`, storage setting)
- `.funcignore`: files excluded during Azure Functions publish

Note: The API currently runs through `Express` (`src/app.js` + `src/server.js`).
These Azure Functions files are added as platform/deployment groundwork.

---

## API Endpoints

### Users API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users` | Public | Get all users |
| GET | `/api/users/:id` | Public | Get user by ID |
| POST | `/api/users` | Public | Register new user |
| DELETE | `/api/users/:id` | JWT | Delete user |
| PUT | `/api/users/:id/status` | JWT | Update user status |
| POST | `/api/login` | Public | Login (returns JWT) |
| POST | `/api/guest-login` | Public | Guest login (rate limited) |

### Sessions API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/sessions` | Public | Get all sessions |
| GET | `/api/sessions/:id` | Public | Get session by ID |
| POST | `/api/sessions` | JWT | Create new session |
| PUT | `/api/sessions/:id` | JWT | Update session |
| DELETE | `/api/sessions/:id` | JWT | Delete session |
| GET | `/api/sessions/available` | Public | Get available sessions |
| GET | `/api/sessions/status/:status` | Public | Get sessions by status |
| POST | `/api/sessions/:sessionId/users/:userId` | JWT | Add user to session |
| DELETE | `/api/sessions/:sessionId/users/:userId` | JWT | Remove user from session |
| GET | `/api/sessions/:sessionId/users` | Public | Get users in session |

---

## Authentication

All protected routes require JWT token in the Authorization header:

```txt
Authorization: Bearer <jwt_token>
```

---

## Project Structure

```txt
ludo-backend/
|-- src/
|   |-- config/
|   |   |-- auth.js
|   |   `-- database.js
|   |-- controllers/
|   |   |-- usersController.js
|   |   `-- sessionsController.js
|   |-- middleware/
|   |   |-- auth.js
|   |   `-- rateLimiter.js
|   |-- models/
|   |   |-- User.js
|   |   `-- Session.js
|   |-- routes/
|   |   |-- users.js
|   |   `-- sessions.js
|   |-- app.js
|   `-- server.js
|-- migrations/
|-- host.json
|-- local.settings.json
|-- .funcignore
|-- knexfile.js
|-- package.json
|-- .env.example
`-- README.md
```
