# 🕒 Timesheet Management System

A high-fidelity project management and timesheet tracking system built with **Elysia (Bun)**, **Next.js**, and **Prisma**.

## 🚀 Quick Start (Docker)

### 1. PostgreSQL Version (Production-like)
```bash
docker-compose up --build
```
*   **Web**: http://localhost:3001
*   **API**: http://localhost:3000
*   **Database**: PostgreSQL 15

### 2. SQLite Version (Local Development)
```bash
docker-compose -f docker-compose.local.yml up --build
```

---

## 🛠️ Manual Setup

### Prerequisites
- [Bun](https://bun.sh) (v1.x)
- Node.js (Optional, for compatibility)

### 1. Server Setup
```bash
cd apps/server
cp .env.example .env
bun install
bunx prisma db push
bun src/index.ts
```

### 2. Web Setup
```bash
cd apps/web
bun install
bun run dev
```

---

## 📡 API Documentation

### Auth
- `POST /auth/register`: Register new user
- `POST /auth/login`: Login & get JWT

### Timesheet
- `GET /timesheet`: Get entries (User: own, Admin: all)
- `POST /timesheet`: Create new entry
- `PUT /timesheet/:id`: Update entry
- `DELETE /timesheet/:id`: Delete entry
- `POST /timesheet/bulk-delete`: Delete multiple entries

### Holidays (Admin Only)
- `GET /holiday`: Get all holidays
- `POST /holiday`: Create holiday
- `DELETE /holiday/:id`: Remove holiday

### Settings
- `GET /settings`: Get system settings
- `POST /settings`: Update settings (Telegram Bot, etc)

---

## 📅 Features
- **Dynamic Calendar**: Interactive calendar for input and visualization.
- **Indonesian Holidays 2026**: Pre-seeded national holidays.
- **Smart Export**: CSV export with automatic weekend/holiday filling.
- **Role-Based Access**: Admins can manage everything, Users manage their own data.
- **Telegram Bot**: Integrated notifications and inputs.

## 🗄️ Database Choice
The system supports both **SQLite** and **PostgreSQL**.
To switch, update `DATABASE_URL` in your `.env` file and change the `provider` in `prisma/schema.prisma` if necessary (current schema uses `sqlite`).

> [!NOTE]
> If switching to PostgreSQL, ensure you change the provider in `apps/server/prisma/schema.prisma` from `sqlite` to `postgresql`.