# MAP eTicket — Backend

Node.js · Express · TypeScript · Prisma · MySQL

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Framework | Express 4 |
| Language | TypeScript 5 |
| ORM | Prisma 5 |
| Database | MySQL 8 |
| Auth | JWT (access token) + HttpOnly refresh cookie |
| Validation | Zod |
| Email | Nodemailer |
| File upload | Multer |

---

## Project structure

```
backend/
├── prisma/
│   ├── schema.prisma        # All 14 database models
│   └── seed.ts              # Seeds roles + default superadmin
├── src/
│   ├── app.ts               # Express setup + route wiring
│   ├── config/
│   │   ├── env.ts           # Validated env vars (zod)
│   │   ├── prisma.ts        # PrismaClient singleton
│   │   └── mailer.ts        # Nodemailer + email templates
│   ├── middleware/
│   │   ├── authenticate.ts  # JWT verification
│   │   ├── authorize.ts     # Role-based access control
│   │   ├── errorHandler.ts  # Global error shape
│   │   └── rateLimiter.ts   # Per-route limiters
│   ├── modules/             # Feature modules (routes/controller/service/schema)
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── agencies/
│   │   ├── users/
│   │   ├── tickets/
│   │   ├── refunds/
│   │   ├── transactions/
│   │   ├── subscriptions/
│   │   ├── sellers/
│   │   ├── clients/
│   │   ├── notifications/
│   │   ├── registrations/
│   │   ├── api-config/
│   │   └── reports/
│   ├── types/
│   │   └── express.d.ts     # req.user augmentation
│   └── utils/
│       ├── jwt.ts
│       ├── paginate.ts
│       └── activityLog.ts
```

---

## Quick start

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your database URL, JWT secrets, and mail config
```

### 3. Set up the database

**Option A — existing MySQL database (just sync schema):**
```bash
npm run prisma:push
```

**Option B — fresh database with migrations:**
```bash
npm run prisma:migrate
```

### 4. Seed roles + superadmin

```bash
npm run prisma:seed
```

Default superadmin credentials:
- Email: `superadmin@mapticket.com`
- Password: `Admin@1234`

> ⚠️ Change the password immediately after first login.

### 5. Start the dev server

```bash
npm run dev
# Server starts at http://localhost:3001
```

---

## API overview

All endpoints are prefixed with `/api`.

### Auth
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/auth/login` | Public |
| POST | `/auth/logout` | Auth |
| POST | `/auth/refresh` | Public |
| GET | `/auth/me` | Auth |
| POST | `/auth/forgot-password` | Public |
| POST | `/auth/reset-password` | Public |

### Roles
- `superadmin` — platform-wide, manages agencies, admins, subscriptions
- `admin` — agency-scoped, manages tickets, refunds, sellers, clients
- `accountant` — agency-scoped, read-only financial access

### Response shape

All responses follow this shape:

```json
{
  "success": true,
  "data": { ... }
}
```

Paginated responses include:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 100,
    "perPage": 15,
    "currentPage": 1,
    "totalPages": 7,
    "hasPrev": false,
    "hasNext": true
  }
}
```

Error responses:

```json
{
  "success": false,
  "message": "Human-readable error message"
}
```

### Authentication header

```
Authorization: Bearer <accessToken>
```

Access tokens expire in **15 minutes**. Use `POST /auth/refresh` (sends the refresh cookie automatically) to get a new one.

---

## Database

Run Prisma Studio to browse data visually:

```bash
npm run prisma:studio
```

---

## Build for production

```bash
npm run build
npm start
```
