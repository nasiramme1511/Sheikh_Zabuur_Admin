# Sheikh Zabuur — Admin Dashboard & Content Management Platform

Enterprise-grade Administration Platform and Content Management System for the **Sheikh Zabuur (ሼክ ዘቡር)** Islamic Audio Library mobile application (`nasiramme1511/Sheikh_Zabuur`).

---

## 1. Project Overview & Architecture

The Sheikh Zabuur Admin Platform powers the content lifecycle for over **1,731 audio recordings** across **8 curriculum modules** and **105 categories**, serving **36.85 GB (1,393.55 hours)** of Islamic educational audio content.

```
+-------------------------------------------------------------------------+
|                              CLIENT TIER                                |
|                                                                         |
|  +--------------------------------+   +------------------------------+  |
|  |  React Native Mobile App       |   |  Next.js 15 Admin Web UI     |  |
|  |  (Offline-First SQLite Cache)  |   |  (Desktop / Mobile Browser)  |  |
|  +--------------------------------+   +------------------------------+  |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                       EDGE ROUTING & CDN (Cloudflare)                  |
|                                                                         |
|  - Global Audio Streaming CDN (audio.sheikhzabur.com)                   |
|  - Edge SSL / TLS Termination & Rate Limiting                           |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                     APPLICATION RUNTIME (Vercel / Node.js)              |
|                                                                         |
|  Next.js 15 App Router (TypeScript Strict Mode)                         |
|  - Route Protection Middleware & Argon2id Session Engine                |
|  - Sliding-Window In-Memory Rate Limiters (Auth, Push, Catalog)         |
|  - Public Mobile API (/api/v1/*): Catalog, Version, Push, Announcements |
|  - Admin API (/api/admin/*): Tracks, Modules, Uploads, Releases, Users  |
|  - Persistent Floating CDN Audio Player Engine                          |
|  - Atomic Catalog Compiler & Instant Mobile Rollback Engine             |
+-------------------+-------------------------------+---------------------+
                    |                               |
                    v                               v
+------------------------------------+ +----------------------------------+
|   DATABASE (Neon Serverless PG)    | |   CLOUD STORAGE (Cloudflare R2)  |
|                                    | |                                  |
|  - 1,731 Audio Tracks (fileSize)   | |  - Direct-to-Cloud Presigned PUT |
|  - 8 Curriculum Modules            | |  - 36.85 GB Audio Catalog Assets |
|  - 105 Categories (2 Nested)       | |  - catalog.json & manifests      |
|  - RBAC Matrix & Audit Logs        | |  - Historical Version Snapshots  |
|  - PgBouncer Connection Pooling    | |  - Zero-Egress Bandwidth         |
+------------------------------------+ +----------------------------------+
```

### Core Architecture Principles
1. **Zero Mobile Breakage:** The mobile application is an offline-first React Native / Expo application with local SQLite persistence (`downloads`, `favorites`, `playback_progress`). Track IDs (e.g. `beyquna-001`, `usul-kitabul-tohid-001`) are strictly immutable.
2. **Decoupled Deployment:** The admin portal and mobile client have completely independent deployment pipelines. The admin platform is never a runtime dependency for already-downloaded mobile audio tracks.
3. **Defense in Depth:** Dual-layer brute-force defense (network rate limiting + DB-level account lockout), Argon2id password hashing, SHA-256 hashed sessions, granular RBAC, and tamper-evident audit logging.

---

## 2. Technology Stack

* **Framework:** Next.js 15.1 (App Router)
* **Language:** TypeScript 5.7+ (Strict Mode)
* **Styling:** Tailwind CSS + Emerald & Gold Islamic educational aesthetic
* **Database & ORM:** Neon Serverless PostgreSQL + Prisma ORM 6.x
* **Security & Auth:** Argon2id hashing, Web Crypto SHA-256 sessions, SameSite=Lax HttpOnly cookies
* **Object Storage:** Cloudflare R2 / AWS S3 (via `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`)
* **Push Notifications:** Expo Server Push Gateway client with batch chunking
* **Validation:** Zod 3.x
* **Icons:** Lucide React
* **CI/CD:** GitHub Actions + Vercel Deployment

---

## 3. Comprehensive Feature Tour

| Module | Route | Key Features |
|---|---|---|
| **Audio Library** | `/library` | Live search by English/Amharic/Arabic title, filename, track ID. Cascading module/category filters, status filter (Published vs Draft), paginated table, quick audio preview, and metadata edit modal. |
| **Modules & Categories** | `/modules`, `/categories` | Hierarchical overview of all 8 curriculum modules and 105 categories. Edit titles, Arabic titles, display orders, and descriptions. |
| **Cloud Upload Center** | `/upload` | Direct-to-cloud presigned S3/R2 uploads. Drag-and-drop zone, client-side HTML5 Audio duration pre-inspection, editable staging list, real-time XHR upload progress bars, and instant audio preview. |
| **Floating Audio Player** | Global | Persistent bottom playback bar streaming audio directly from Cloudflare R2 CDN. Scrubbable waveform timeline, -10s/+10s seek controls, volume/mute slider, and 0.75x–2x playback speed toggle. |
| **Catalog Releases** | `/releases` | Atomic catalog compiler adhering to mobile `catalog.json` and `catalogVersion.json` schema. Calculates MD5 and SHA-256 checksums, enforces quality gates (min 1,731 tracks, 0 duplicate IDs), provides release diff inspection, SemVer recommendation, and **one-click instant rollback**. |
| **Announcements** | `/announcements` | Scheduled in-app notices for mobile users. Bilingual English/Amharic modal composer, type selection (`info`, `warning`, `event`, `release`), priority weighting, and external link attachment. |
| **Push Notifications** | `/push` | Interactive Expo Push Notification broadcaster. Audience targeting (`all`, `ios`, `android`), interactive live smartphone mockup (iOS/Android lock screen simulation), and broadcast history table. |
| **Admin Users & RBAC** | `/users`, `/roles` | User administration with Argon2id passwords, role assignment (`SUPER_ADMIN`, `CONTENT_MANAGER`, `EDITOR`, `VIEWER`), self-deletion safeguards, last Super Admin protection, and dynamic domain permission matrix. |
| **Security Audit Trail** | `/audit` | Comprehensive searchable audit log capturing timestamps, actor emails, actions, entity types, record IDs, IP addresses, user agents, and full JSON changeset payloads. |
| **System Settings** | `/settings` | Centralized platform configuration (maintenance mode switch, min supported app version, in-app banner toggle, cellular streaming policy, CDN cache TTL). |

---

## 4. API Endpoints Directory

### Public Mobile API (`/api/v1/*`)
Public endpoints consumed by the React Native mobile application. Fully open CORS enabled.

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/v1/catalog/version` | GET | Returns latest catalog version, MD5/SHA256 checksums, and update status |
| `GET /api/v1/catalog` | GET | Full compiled JSON catalog (modules, categories, and tracks) |
| `GET /api/v1/announcements` | GET | Active prioritized in-app announcements for mobile display |
| `POST /api/v1/push/register` | POST | Registers or refreshes mobile Expo Push device tokens (rate-limited) |
| `GET /api/v1/settings` | GET | Public client configuration flags and minimum app version |

### Administrative API (`/api/admin/*`)
Secured endpoints requiring active administrator session and verified RBAC permissions.

| Endpoint | Method | Permission | Description |
|---|---|---|---|
| `POST /api/admin/auth/login` | POST | None (Public) | Secure login with Argon2id and brute-force protection |
| `POST /api/admin/auth/logout` | POST | Session | Terminates active session and clears auth cookies |
| `GET /api/admin/auth/me` | GET | Session | Returns current authenticated administrator profile and role |
| `GET /api/admin/tracks` | GET | `tracks:read` | Paginated, searchable, filtered audio track records |
| `GET /api/admin/tracks/[id]` | GET | `tracks:read` | Single track details |
| `PUT /api/admin/tracks/[id]` | PUT | `tracks:write` | Updates track metadata and status (audited) |
| `GET /api/admin/modules` | GET | `modules:read` | List curriculum modules with category & track counts |
| `GET /api/admin/categories` | GET | `categories:read` | List categories with module associations |
| `PUT /api/admin/categories/[id]` | PUT | `categories:write` | Update category metadata (audited) |
| `POST /api/admin/uploads/presign` | POST | `tracks:write` | Generates S3/R2 presigned PUT upload URL |
| `POST /api/admin/uploads/complete` | POST | `tracks:write` | Atomic track insertion upon completed cloud upload |
| `GET /api/admin/releases` | GET | `releases:read` | Release history and active publication status |
| `POST /api/admin/releases/compile` | POST | `releases:write` | Compiles draft release and analyzes changes |
| `POST /api/admin/releases/publish` | POST | `releases:publish`| Atomically deploys active catalog release |
| `POST /api/admin/releases/[id]/rollback` | POST | `releases:publish`| Instantly rolls back to a previous catalog release |
| `GET /api/admin/announcements` | GET | `announcements:read`| List all system announcements |
| `POST /api/admin/announcements` | POST | `announcements:write`| Create announcement |
| `PUT /api/admin/announcements/[id]` | PUT | `announcements:write`| Update announcement |
| `DELETE /api/admin/announcements/[id]` | DELETE | `announcements:write`| Delete announcement |
| `GET /api/admin/push/stats` | GET | `push:read` | Active push tokens by platform breakdown |
| `GET /api/admin/push/broadcasts` | GET | `push:read` | Broadcast delivery history and metrics |
| `POST /api/admin/push/broadcast` | POST | `push:send` | Dispatches push notification to mobile devices |
| `GET /api/admin/users` | GET | `users:read` | List administrator accounts |
| `POST /api/admin/users` | POST | `users:write` | Create administrator account with Argon2id |
| `PUT /api/admin/users/[id]` | PUT | `users:write` | Update user status, role, or reset password |
| `DELETE /api/admin/users/[id]` | DELETE | `users:write` | Deactivate/remove administrator |
| `GET /api/admin/roles` | GET | `roles:read` | List roles and permissions |
| `PUT /api/admin/roles/[id]` | PUT | `roles:write` | Update role permissions matrix |
| `GET /api/admin/audit` | GET | `audit:read` | Paginated, searchable security audit log |
| `GET /api/admin/settings` | GET | `settings:read` | Read system settings |
| `PUT /api/admin/settings` | PUT | `settings:write`| Update system settings |
| `GET /api/health` | GET | None (Public) | Deep subsystem health check and latency report |

---

## 5. Getting Started & Local Development

### Prerequisites
* **Node.js:** `>= 20.x`
* **npm:** `>= 10.x`
* **PostgreSQL:** Neon Serverless PostgreSQL or local PostgreSQL 14+

### Setup Instructions

1. Clone repository:
   ```bash
   git clone https://github.com/nasiramme1511/Sheikh_Zabuur_Admin.git
   cd Sheikh_Zabuur_Admin
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your Neon connection string and AUTH_SECRET
   ```

4. Push schema and generate Prisma client:
   ```bash
   npx prisma db push
   npm run prisma:generate
   ```

5. Seed foundational RBAC roles and permissions:
   ```bash
   npm run db:seed
   ```

6. Bootstrap Super Administrator account:
   ```bash
   ADMIN_EMAIL="admin@sheikhzabur.com" \
   ADMIN_PASSWORD="YourSecurePassword123!" \
   ADMIN_NAME="Super Admin" \
   npm run admin:bootstrap
   ```

7. Import the 1,731 mobile audio catalog tracks:
   ```bash
   npm run catalog:import
   ```

8. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) and sign in.

---

## 6. Project Scripts Reference

| Command | Purpose |
|---|---|
| `npm run dev` | Starts local Next.js development server on port 3000 |
| `npm run build` | Compiles production bundle with Prisma client generation |
| `npm run start` | Boots compiled Next.js production server |
| `npm run typecheck` | Strict TypeScript verification (`tsc --noEmit`) |
| `npm run lint` | ESLint static code quality inspection |
| `npm run format` | Prettier automated code formatting |
| `npm run prisma:generate` | Compiles Prisma ORM client |
| `npm run prisma:validate` | Validates Prisma schema syntax and relations |
| `npm run db:seed` | Seeds roles, permissions, and default system settings |
| `npm run admin:bootstrap` | Command-line Super Admin account creator/reset |
| `npm run catalog:import` | Seeds all 1,731 audio tracks and 105 categories |

---

## 7. Operational Playbooks

Detailed operational runbooks, disaster recovery procedures, and database maintenance guides are located in:
* **[Production Operations Manual](docs/PRODUCTION_OPERATIONS_MANUAL.md)**
* **[Phase Implementation Reports](docs/)**
* **[Architecture Audit Reports](docs/)**

---

## 8. License & Ownership

Proprietary software developed for the Sheikh Zabuur Islamic Audio Library platform. All rights reserved.
