# Strategic Ludo Game Backend (Node.js)

REST API Backend for Strategic Ludo game with user management, authentication, and game session management.

---

## Technology Stack

| Layer | Technology |
|-------|-------------|
| Runtime | Node.js (LTS) |
| Language | JavaScript (ES6+) |
| Framework | Express.js |
| Database | PostgreSQL |
| Query Builder | Knex.js |
| Authentication | JWT (jsonwebtoken) |
| Password Hashing | bcrypt |
| Validation | express-validator |
| Environment | dotenv |

---

## Prerequisites

- Node.js 18+
- PostgreSQL (Azure or local)

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
DB_HOST=your-azure-postgres-host.postgres.database.azure.com
DB_PORT=5432
DB_NAME=ludo
DB_USER=your-username
DB_PASSWORD=your-password
JWT_SECRET=your-super-secret-jwt-key
```

---

## Database Migrations

Run migrations to create tables:

```bash
npm run migrate
```

Rollback migrations:

```bash
npm run migrate:rollback
```

---

## Run Commands

```bash
npm run dev      # Development (with nodemon)
npm start        # Production
npm test         # Run tests
```

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

All protected routes require JWT token in Authorization header:

```
Authorization: Bearer <jwt_token>
```

---

## Project Structure

```
ludo-backend/
├── src/
│   ├── config/
│   │   ├── database.js      # Knex configuration
│   │   └── auth.js          # JWT secret, config
│   ├── controllers/
│   │   ├── usersController.js
│   │   └── sessionsController.js
│   ├── routes/
│   │   ├── users.js
│   │   └── sessions.js
│   ├── middleware/
│   │   ├── auth.js          # JWT verification
│   │   └── rateLimiter.js   # Rate limiting
│   ├── models/
│   │   ├── User.js
│   │   └── Session.js
│   ├── utils/
│   │   └── helpers.js
│   ├── app.js               # Express app setup
│   └── server.js            # Entry point
├── migrations/              # Database migrations
├── knexfile.js
├── package.json
├── .env.example
└── README.md
```
