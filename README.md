# Sheikh Zabuur — Admin Dashboard & Content Management Platform

Enterprise-grade Administration Platform and Content Management System for the **Sheikh Zabuur (ሼክ ዘቡር)** Islamic Audio Library mobile application.

---

## 1. Project Overview

The Sheikh Zabuur Admin Platform manages the full audio lifecycle:
- Hierarchical content management (8 curricula modules, 100+ categories).
- 1,731 audio recordings (metadata, multilingual titles in Amharic & Arabic).
- Resilient direct-to-object-storage uploads (presigned URLs).
- Atomic catalog compiler and publishing engine.
- Push notification broadcasting and system announcements.
- Strict role-based access control (RBAC) and tamper-evident audit logging.

The admin platform maintains strict separation from the mobile repository (`nasiramme1511/Sheikh_Zabuur`), safeguarding Expo EAS mobile builds and preserving existing offline-playback SQLite databases on users' devices.

---

## 2. Technology Stack (Phase 1 Foundation)

* **Framework:** Next.js 15 (App Router)
* **Language:** TypeScript 5.7+ (Strict Mode)
* **Styling:** Tailwind CSS + Emerald & Gold Islamic educational theme
* **Database & ORM:** PostgreSQL + Prisma ORM 6.x
* **Validation:** Zod 3.x
* **Icons:** Lucide React
* **Code Quality:** ESLint 9 + Prettier

---

## 3. Getting Started

### Prerequisites

* **Node.js:** `>= 20.x` (Recommended: Node 22 or 24 LTS)
* **npm:** `>= 10.x`
* **PostgreSQL:** `>= 14.x` (Local instance or Neon Serverless PostgreSQL)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/nasiramme1511/Sheikh_Zabuur_Admin.git
   cd Sheikh_Zabuur_Admin
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your PostgreSQL DATABASE_URL
   ```

4. Generate Prisma Client:
   ```bash
   npm run prisma:generate
   ```

5. Run the local development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Available Project Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Next.js development server on port 3000 |
| `npm run build` | Generates Prisma client and compiles production build |
| `npm run start` | Starts Next.js production server |
| `npm run lint` | Runs ESLint checks |
| `npm run typecheck` | Runs TypeScript compiler verification (`tsc --noEmit`) |
| `npm run format` | Auto-formats code with Prettier |
| `npm run format:check` | Verifies code formatting |
| `npm run prisma:generate` | Generates Prisma Client from `prisma/schema.prisma` |
| `npm run prisma:validate` | Validates Prisma schema integrity |

---

## 5. Health Check API

The platform provides a health check endpoint for monitoring, uptime checks, and deployment verification:

```bash
curl http://localhost:3000/api/health
```

Example response when database is connected:
```json
{
  "status": "ok",
  "timestamp": "2026-11-10T22:30:00.000Z",
  "uptimeSeconds": 42,
  "environment": "development",
  "version": "0.1.0-phase1",
  "checks": {
    "database": {
      "status": "healthy",
      "latencyMs": 12
    }
  }
}
```

---

## 6. Security & Credential Rules

1. **Zero Secret Leakage:** Database credentials and signing secrets are restricted to server-side execution. `src/lib/env.ts` validates configuration at boot and prevents client-side exposure.
2. **No Default Passwords:** The system does not ship with hardcoded administrator credentials.
3. **Storage Independence:** Future cloud storage integrations will use provider-agnostic S3-compatible interfaces.

---

## 7. License & Ownership

Proprietary software for the Sheikh Zabuur Islamic Audio Library platform.
