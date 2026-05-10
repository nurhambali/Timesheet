# 📋 Timesheet App — Implementation Plan

> **Tech Stack:** Bun + Elysia.js + Prisma (SQLite/PostgreSQL) + Next.js + shadcn/ui + Telegram Bot
> **Target:** Beginner-friendly, step-by-step guide

---

## 🏗️ Arsitektur Aplikasi

```mermaid
graph TB
    subgraph "Frontend (Next.js + shadcn/ui)"
        A["📊 Dashboard"]
        B["📝 Form Timesheet"]
        C["👤 User Management"]
        D["📈 Laporan / Report"]
    end

    subgraph "Backend (Bun + Elysia.js)"
        E["🔐 Auth API"]
        F["⏱️ Timesheet API"]
        G["👥 User API"]
        H["🤖 Telegram Webhook"]
    end

    subgraph "Database (Prisma ORM)"
        I[("SQLite (Dev) / PostgreSQL (Prod)")]
    end

    subgraph "Telegram"
        J["📱 Telegram Bot"]
    end

    A --> F
    B --> F
    C --> G
    D --> F
    E --> I
    F --> I
    G --> I
    H --> I
    J -->|"Webhook"| H
    H -->|"Response"| J
```

---

## 📂 Struktur Folder Project

```
d:\Hambali\Home\Timesheet\
├── apps/
│   ├── server/              # Backend (Bun + Elysia.js)
│   │   ├── src/
│   │   │   ├── index.ts         # Entry point
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts      # Login, register
│   │   │   │   ├── timesheet.ts # CRUD timesheet
│   │   │   │   ├── user.ts      # User management
│   │   │   │   └── telegram.ts  # Webhook handler
│   │   │   ├── services/
│   │   │   │   ├── timesheet.service.ts
│   │   │   │   ├── user.service.ts
│   │   │   │   └── telegram.service.ts
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts      # JWT middleware
│   │   │   └── lib/
│   │   │       ├── prisma.ts    # Prisma client
│   │   │       └── telegram.ts  # Telegram bot setup
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # Database schema
│   │   │   └── seed.ts          # Seed data
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                 # Frontend (Next.js + shadcn/ui)
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx         # Landing/Login
│       │   │   ├── dashboard/
│       │   │   │   └── page.tsx     # Dashboard utama
│       │   │   ├── timesheet/
│       │   │   │   └── page.tsx     # List & form
│       │   │   └── settings/
│       │   │       └── page.tsx     # Pengaturan Telegram
│       │   ├── components/
│       │   │   ├── ui/              # shadcn components
│       │   │   ├── sidebar.tsx
│       │   │   ├── timesheet-table.tsx
│       │   │   └── timesheet-form.tsx
│       │   └── lib/
│       │       ├── api.ts           # API client
│       │       └── utils.ts
│       ├── package.json
│       └── tsconfig.json
│
├── .gitignore
├── package.json             # Root workspace
└── README.md
```

---

## 📊 Database Schema (Prisma)

```prisma
// prisma/schema.prisma

datasource db {
  provider = "sqlite"         // Ganti "postgresql" untuk production
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id            String      @id @default(cuid())
  email         String      @unique
  name          String
  password      String
  telegramId    String?     @unique
  telegramToken String?     @unique
  role          Role        @default(USER)
  timesheets    Timesheet[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model Timesheet {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  date        DateTime
  startTime   String?  // Format HH:mm
  endTime     String?  // Format HH:mm
  activity    String
  duration    Float    // Dalam jam
  note        String?
  source      Source   @default(WEB)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, date])
}

model Holiday {
  id        String   @id @default(cuid())
  date      DateTime @unique
  title     String
  createdAt DateTime @default(now())
}

enum Role {
  ADMIN
  USER
}

enum Source {
  WEB
  TELEGRAM
}
```

---

## 🤖 Alur Integrasi Telegram

```mermaid
sequenceDiagram
    participant U as 👤 User (Web)
    participant W as 🌐 Frontend
    participant S as ⚙️ Server
    participant DB as 🗃️ Database
    participant T as 📱 Telegram Bot

    Note over U,W: STEP 1: Link Akun Telegram
    U->>W: Buka halaman Settings
    W->>S: GET /api/user/telegram-token
    S->>DB: Generate & simpan token unik
    S-->>W: Return token
    W-->>U: Tampilkan instruksi: "/start TOKEN" di Bot

    Note over U,T: STEP 2: Aktivasi di Telegram
    U->>T: Kirim "/start abc123token"
    T->>S: POST /api/telegram/webhook
    S->>DB: Cari user by token, simpan telegramId
    S-->>T: "✅ Akun terhubung! Nama: Hambali"

    Note over U,T: STEP 3: Input Timesheet via Telegram
    U->>T: Kirim "/log 2h Meeting client ProjectX"
    T->>S: POST /api/telegram/webhook
    S->>DB: Parse pesan & simpan timesheet
    S-->>T: "✅ Tercatat: 2 jam - Meeting client (ProjectX)"

    Note over U,W: STEP 4: Lihat di Dashboard
    U->>W: Buka Dashboard
    W->>S: GET /api/timesheet
    S->>DB: Query timesheet user
    S-->>W: Return data
    W-->>U: Tampilkan tabel + grafik
```

---

## 📝 Tahapan Implementasi (Step-by-Step)

### Phase 1: Setup Project ⚙️

| Step | Apa yang dilakukan | Detail |
|------|-------------------|--------|
| 1.1 | Install Bun | Download dari [bun.sh](https://bun.sh), jalankan installer |
| 1.2 | Buat root project | `bun init` di folder Timesheet |
| 1.3 | Setup backend (Elysia) | `bun create elysia ./apps/server` |
| 1.4 | Setup frontend (Next.js) | `bunx create-next-app@latest ./apps/web` |
| 1.5 | Install shadcn/ui | `bunx shadcn@latest init` di folder web |
| 1.6 | Install Prisma | `bun add prisma @prisma/client` di folder server |
| 1.7 | Init Prisma | `bunx prisma init --datasource-provider sqlite` |
| 1.8 | Buat schema | Salin schema di atas ke `prisma/schema.prisma` |
| 1.9 | Generate & migrate | `bunx prisma migrate dev --name init` |

> [!TIP]
> Gunakan SQLite dulu untuk development karena tidak perlu install database server. Nanti tinggal ganti ke PostgreSQL saat deploy.

---

### Phase 2: Backend — Auth & User API 🔐

| Step | Apa yang dilakukan | Detail |
|------|-------------------|--------|
| 2.1 | Setup Prisma client | Buat `src/lib/prisma.ts` — singleton client |
| 2.2 | Install plugin JWT | `bun add @elysiajs/jwt @elysiajs/cookie` |
| 2.3 | Buat auth routes | `POST /auth/register` dan `POST /auth/login` |
| 2.4 | Buat JWT middleware | Verifikasi token di setiap request |
| 2.5 | Buat user routes | `GET /user/me`, `PUT /user/me` |
| 2.6 | Test dengan curl/Thunder Client | Pastikan register → login → get profile works |

**Contoh endpoint:**
```
POST /auth/register  → { email, name, password }
POST /auth/login     → { email, password } → return JWT token
GET  /user/me        → return user profile (requires auth)
```

---

### Phase 3: Backend — Timesheet CRUD API ⏱️

| Step | Apa yang dilakukan | Detail |
|------|-------------------|--------|
| 3.1 | Buat timesheet routes | CRUD lengkap |
| 3.2 | Tambahkan validasi | Gunakan Elysia `t.Object()` untuk type validation |
| 3.3 | Filter & pagination | Query by date range, project |
| 3.4 | Summary endpoint | Total jam per hari/minggu/bulan |
| 3.5 | Test API | Pastikan semua CRUD berjalan |

**Contoh endpoint:**
```
POST   /timesheet          → Buat entry baru
GET    /timesheet           → List (filter: date, project)
GET    /timesheet/:id       → Detail satu entry
PUT    /timesheet/:id       → Update entry
DELETE /timesheet/:id       → Hapus entry
GET    /timesheet/summary   → Ringkasan jam kerja
```

---

### Phase 4: Frontend — Dashboard 📊

| Step | Apa yang dilakukan | Detail |
|------|-------------------|--------|
| 4.1 | Install shadcn components | `button, card, table, dialog, form, input, select, calendar, chart` |
| 4.2 | Buat layout sidebar | Navigasi: Dashboard, Timesheet, Settings |
| 4.3 | Buat halaman Login | Form login + register |
| 4.4 | Buat Dashboard | Card ringkasan + chart jam kerja per minggu |
| 4.5 | Buat halaman Timesheet | Tabel data + form tambah/edit (dialog) |
| 4.6 | Buat halaman Settings | Form profile + section Telegram linking |
| 4.7 | API client | Fetch wrapper dengan JWT token |

> [!IMPORTANT]
> Pastikan semua halaman responsive dan mobile-friendly. shadcn/ui sudah responsive by default, tapi sidebar perlu di-handle khusus untuk mobile.

---

### Phase 5: Integrasi Telegram 🤖

| Step | Apa yang dilakukan | Detail |
|------|-------------------|--------|
| 5.1 | Buat bot di Telegram | Chat `@BotFather`, jalankan `/newbot` |
| 5.2 | Simpan bot token | Masukkan ke `.env` sebagai `TELEGRAM_BOT_TOKEN` |
| 5.3 | Install Grammy | `bun add grammy` (library Telegram bot untuk Bun) |
| 5.4 | Buat webhook endpoint | `POST /telegram/webhook` di Elysia |
| 5.5 | Handle `/start TOKEN` | Link akun web ↔ Telegram |
| 5.6 | Handle `/log` command | Parse dan simpan timesheet |
| 5.7 | Handle `/summary` command | Kirim ringkasan jam kerja hari ini |
| 5.8 | Set webhook URL | `https://your-domain.com/api/telegram/webhook` |
| 5.9 | Buat UI Settings | Tombol "Link Telegram" + generate token + instruksi |

**Telegram Commands yang didukung:**
```
/start TOKEN        → Link akun (satu kali)
/log 2h Meeting     → Catat 2 jam meeting
/today              → Lihat timesheet hari ini
/summary            → Ringkasan minggu ini
/help               → Panduan penggunaan

**Fitur Tambahan Terimplementasi:**
- **FullCalendar View**: Visualisasi jadwal interaktif dengan warna khusus Weekend & Libur.
- **Admin Holiday Manager**: Panel khusus admin untuk kelola tanggal merah & Bulk Import CSV.
- **Smart Export CSV**: Laporan otomatis mengisi baris 24 jam untuk libur/weekend.
- **RTK Proxy**: Optimasi output terminal untuk pengembang.
- **Docker Multi-Env**: Mendukung Postgres & SQLite via Docker Compose.
```

**Contoh format parsing `/log`:**
```
Input:  "/log 2h Meeting client ProjectX"
Parse:  duration=2, activity="Meeting client", project="ProjectX"
```

> [!NOTE]
> Untuk development lokal, gunakan [ngrok](https://ngrok.com) agar Telegram bisa mengirim webhook ke localhost Anda.

---

### Phase 6: Polish & Deploy 🚀

| Step | Apa yang dilakukan | Detail |
|------|-------------------|--------|
| 6.1 | Ganti SQLite → PostgreSQL | Ubah `provider` di schema.prisma + `DATABASE_URL` |
| 6.2 | Seed data | Buat user admin default |
| 6.3 | Error handling | Tambahkan global error handler |
| 6.4 | Environment config | `.env.example` untuk dokumentasi |
| 6.5 | Docker compose | Container untuk app + PostgreSQL |
| 6.6 | Deploy | VPS / Railway / Vercel (frontend) |

---

## 🔑 Environment Variables

```env
# Database
DATABASE_URL="file:./dev.db"                    # SQLite (dev)
# DATABASE_URL="postgresql://user:pass@localhost:5432/timesheet"  # PostgreSQL (prod)

# JWT
JWT_SECRET="your-super-secret-key-here"

# Telegram
TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."         # Dari BotFather
TELEGRAM_WEBHOOK_URL="https://your-domain.com/api/telegram/webhook"

# Server
PORT=3001

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

---

## ✅ Checklist Progress

- [x] **Phase 1:** Setup project (Bun, Elysia, Next.js, Prisma, shadcn)
- [x] **Phase 2:** Auth & User API
- [x] **Phase 3:** Timesheet CRUD API
- [x] **Phase 4:** Frontend Dashboard & Calendar
- [ ] **Phase 5:** Integrasi Telegram (In Progress)
- [x] **Phase 6:** Polish & Deploy (Docker & Postgres Ready)

---

## 💡 Tips untuk Pemula

> [!TIP]
> **Kerjakan secara bertahap!** Jangan loncat-loncat phase. Pastikan satu phase selesai dan tested sebelum lanjut ke phase berikutnya.

1. **Mulai dari backend dulu** — pastikan API bisa ditest pakai Thunder Client / Postman
2. **Database pakai SQLite** — tidak perlu install apa-apa, tinggal jalan
3. **Frontend connect ke API** — baru setelah API sudah stable
4. **Telegram terakhir** — ini fitur tambahan, core app harus jalan dulu
5. **Git commit sering-sering** — setiap selesai 1 step, langsung commit
6. **Baca error message** — biasanya Bun & Elysia kasih error yang jelas

---

> [!IMPORTANT]
> **Jawaban: Ya, integrasi Telegram BISA dilakukan!** User dari frontend di-link ke Telegram via token unik. Setelah terhubung, user bisa input timesheet langsung dari chat Telegram, dan data muncul di dashboard web.
