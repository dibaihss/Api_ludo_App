# PRD - Strategic Ludo Game Backend (Node.js)

## 1. Project Overview

**Project Name:** Strategic Ludo Backend (Node.js)  
**Project Type:** REST API Backend  
**Core Functionality:** Provide REST APIs for user management, authentication, and game session management for a Strategic Ludo game. This is an API-only skeleton (no WebSockets).  
**Target Users:** Frontend mobile/web applications consuming the REST APIs

---

## 2. Technology Stack

| Layer | Technology |
|-------|-------------|
| Runtime | Node.js (LTS) |
| Language | JavaScript (ES6+) |
| Framework | Express.js |
| Database | PostgreSQL (Azure - same as Spring Boot) |
| Query Builder | Knex.js |
| Authentication | JWT (jsonwebtoken) |
| Password Hashing | bcrypt |
| Validation | express-validator |
| Environment | dotenv |

---

## 3. Features

### 3.1 User Management
- **Create User** - Register new user with name, email, password
- **Get All Users** - Retrieve list of all users
- **Get User by ID** - Retrieve specific user
- **Delete User** - Remove user from database
- **Update User Status** - Toggle user online/offline status

### 3.2 Authentication
- **User Login** - Email/password authentication with JWT token
- **Guest Login** - Anonymous user creation with rate limiting
- **Password Security** - BCrypt hashing (never store plain text)

### 3.3 Session Management
- **Create Session** - Create new game session
- **Get All Sessions** - List all sessions
- **Get Session by ID** - Retrieve specific session
- **Update Session** - Modify session details
- **Delete Session** - Remove session
- **Get Available Sessions** - List sessions not full (less than 4 players)
- **Join Session** - Add user to session
- **Leave Session** - Remove user from session
- **Get Session Users** - List users in a session

---

## 4. Database Schema

### 4.1 Existing Tables (Reuse from Spring Boot)

```sql
-- users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    status BOOLEAN DEFAULT false,
    is_guest BOOLEAN DEFAULT false,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    last_activity TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- sessions table
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    max_players INTEGER DEFAULT 4,
    current_players INTEGER DEFAULT 0
);

-- session_users (join table for many-to-many)
CREATE TABLE session_users (
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, user_id)
);
```

---

## 5. API Endpoints

### 5.1 Users API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users` | Public | Get all users |
| GET | `/api/users/:id` | Public | Get user by ID |
| POST | `/api/users` | Public | Register new user |
| DELETE | `/api/users/:id` | JWT | Delete user |
| PUT | `/api/users/:id/status` | JWT | Update user status |
| POST | `/api/login` | Public | Login (returns JWT) |
| POST | `/api/guest-login` | Public | Guest login (rate limited) |

### 5.2 Sessions API

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

## 6. Request/Response Formats

### 6.1 Create User (POST /api/users)
**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```
**Response:** `201 Created`
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "status": false,
  "isGuest": false,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### 6.2 Login (POST /api/login)
**Request:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```
**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "status": true,
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 6.3 Guest Login (POST /api/guest-login)
**Response:** `200 OK`
```json
{
  "id": 5,
  "name": "Guest_a1b2c3d4",
  "status": true,
  "isGuest": true,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```
**Rate Limited Response:** `429 Too Many Requests`
```json
"Too many guest accounts created. Please try again later."
```

### 6.4 Create Session (POST /api/sessions)
**Request:**
```json
{
  "name": "Room 1",
  "status": "waiting",
  "maxPlayers": 4
}
```
**Response:** `201 Created`
```json
{
  "id": 1,
  "name": "Room 1",
  "status": "waiting",
  "maxPlayers": 4,
  "currentPlayers": 0,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 6.5 Add User to Session (POST /api/sessions/:sessionId/users/:userId)
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User added to session successfully"
}
```

---

## 7. Authentication & Authorization

### 7.1 JWT Token
- **Algorithm:** HS256
- **Expiration:** 24 hours
- **Payload:** `{ userId, email, iat, exp }`

### 7.2 Protected Routes
All routes modifying data require JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

### 7.3 Rate Limiting
- **Endpoint:** `/api/guest-login`
- **Limit:** 2 requests per minute per IP
- **Implementation:** In-memory rate limiter (can migrate to Redis later)

---

## 8. Project Structure

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
│   │   └── rateLimiter.js  # Rate limiting
│   ├── models/
│   │   ├── User.js
│   │   └── Session.js
│   ├── utils/
│   │   └── helpers.js
│   ├── app.js               # Express app setup
│   └── server.js            # Entry point
├── migrations/              # Database migrations
├── .env.example
├── package.json
└── README.md
```

---

## 9. Setup Instructions

### 9.1 Prerequisites
- Node.js 18+
- PostgreSQL (Azure or local)

### 9.2 Installation
```bash
# Clone or create project
mkdir ludo-backend && cd ludo-backend
npm init -y

# Install dependencies
npm install express pg knex bcrypt jsonwebtoken dotenv express-validator cors

# Install dev dependencies
npm install --save-dev nodemon jest
```

### 9.3 Environment Variables (.env)
```env
PORT=3000
DB_HOST=your-azure-postgres-host.postgres.database.azure.com
DB_PORT=5432
DB_NAME=ludo
DB_USER=your-username
DB_PASSWORD=your-password
JWT_SECRET=your-super-secret-jwt-key
```

### 9.4 Run Commands
```bash
npm run dev      # Development (with nodemon)
npm start        # Production
npm test         # Run tests
```

---

## 10. Error Handling

All errors return appropriate HTTP status codes:

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

---

## 11. Testing

### Test Coverage Goals
- Controller unit tests
- Route integration tests
- Auth middleware tests
- Rate limiter tests

### Test Framework
- **Framework:** Jest
- **Database:** Test database or mock queries

```bash
npm test                 # Run all tests
npm test -- --watch     # Watch mode
```

---

## 12. Future Enhancements (Out of Scope)

- WebSocket support for real-time game updates
- Game logic (dice rolling, piece movement, win detection)
- User leaderboards
- Match history
- Social features (friends, chat)
- Push notifications
