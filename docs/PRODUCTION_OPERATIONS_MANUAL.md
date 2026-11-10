# Sheikh Zabuur Admin Platform — Production Operations Manual

## 1. System Architecture & Topology

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
|  - SSL / TLS Termination                                                |
|  - Global Audio Streaming CDN (audio.sheikhzabur.com)                   |
|  - Static Asset Caching                                                 |
|  - Rate Limiting & DDoS Shield                                          |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                     APPLICATION RUNTIME (Vercel / Node.js)              |
|                                                                         |
|  Next.js 15 App Router (TypeScript Strict)                              |
|  - Edge Middleware: Session Auth, Route Guards, CORS, Security Headers  |
|  - Rate Limiting: Sliding-window memory limiters (Auth, Push, Catalog)  |
|  - Public Mobile API (/api/v1/*): Catalog, Version, Push, Announcements |
|  - Admin API (/api/admin/*): Tracks, Modules, Uploads, Releases, Users  |
|  - Floating CDN Audio Player Context                                    |
|  - Catalog Compiler & Instant Rollback Engine                           |
+-------------------+-------------------------------+---------------------+
                    |                               |
                    v                               v
+------------------------------------+ +----------------------------------+
|   DATABASE (Neon Serverless PG)    | |   CLOUD STORAGE (Cloudflare R2)  |
|                                    | |                                  |
|  - 1,731 Audio Tracks (fileSize)   | |  - Presigned Direct Uploads      |
|  - 8 Curriculum Modules            | |  - 36.85 GB MP3 Audio Library    |
|  - 105 Categories (2 Nested)       | |  - catalog.json & manifests      |
|  - RBAC & Audit Trails             | |  - Historical Version Snapshots  |
|  - Connection Pooling (PgBouncer)  | |  - Zero-Egress Bandwidth         |
+------------------------------------+ +----------------------------------+
```

---

## 2. Environment Variables Reference

| Variable | Required | Default / Example | Purpose |
|---|---|---|---|
| `NODE_ENV` | Yes | `production` | Node.js runtime environment |
| `APP_URL` | Yes | `https://admin.sheikhzabur.com` | Base URL of the administration portal |
| `DATABASE_URL` | Yes | `postgresql://user:pass@ep-...-pooler.region.aws.neon.tech/neondb?sslmode=require&pgbouncer=true` | Neon pooled connection string |
| `DIRECT_URL` | No | `postgresql://user:pass@ep-...region.aws.neon.tech/neondb?sslmode=require` | Neon direct connection string (for migrations) |
| `AUTH_SECRET` | Yes | Minimum 32-character random string | Session HMAC cookie signing secret |
| `STORAGE_PROVIDER` | No | `cloudflare-r2` | Object storage provider name |
| `STORAGE_BUCKET_NAME` | No | `sheikh-zabuur-audio-catalog` | Bucket name for audio and catalog JSON |
| `STORAGE_ENDPOINT` | No | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | S3-compatible API endpoint |
| `STORAGE_ACCESS_KEY_ID` | No | Secret access key ID | R2/S3 access key with read/write permissions |
| `STORAGE_SECRET_ACCESS_KEY` | No | Secret access key | R2/S3 secret access key |
| `STORAGE_PUBLIC_BASE_URL` | No | `https://audio.sheikhzabur.com` | Public CDN base URL for audio playback |
| `NEXT_PUBLIC_CDN_BASE_URL` | No | `https://audio.sheikhzabur.com` | Browser client preview audio URL |
| `EXPO_ACCESS_TOKEN` | No | Optional token from expo.dev | Expo Push Notification delivery credential |

---

## 3. Production Deployment Runbook

### Option A: Vercel Deployment (Recommended)
1. Link GitHub repository `nasiramme1511/Sheikh_Zabuur_Admin` to Vercel.
2. Configure Environment Variables in Project Settings matching the table above.
3. Set the build command to `prisma generate && next build`.
4. Deploy to target region `iad1` (US East - Washington D.C.) to minimize latency to Neon `us-east-2`.
5. Configure custom domain `admin.sheikhzabur.com` with DNS CNAME to Vercel.

### Option B: Self-Hosted Docker / VPS
```bash
# 1. Build the production image
docker build -t sheikh-zabuur-admin .

# 2. Run container with environment configuration
docker run -d \
  --name sz-admin \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  sheikh-zabuur-admin
```

---

## 4. Database Operations & Maintenance (Neon Serverless PostgreSQL)

### A. Connection Pooling Best Practices
- Always use the `-pooler` connection string in `DATABASE_URL` for production web servers.
- Neon PgBouncer handles transaction-level pooling and automatically spins down inactive compute instances to reduce costs.
- Append `?sslmode=require&pgbouncer=true&connect_timeout=15` to ensure connection timeouts fail fast rather than hanging serverless lambdas.

### B. Database Backups & Point-In-Time Recovery
- Neon provides continuous write-ahead logging (WAL) and automatic Point-in-Time Recovery (PITR).
- To restore the database to an earlier state or inspect historical data:
  1. Navigate to the Neon Console > **Branches**.
  2. Click **Create Branch** from the `main` branch at a specific past timestamp.
  3. Validate data integrity on the test branch before routing production traffic.

---

## 5. Cloudflare R2 / AWS S3 Storage Setup

### A. Create R2 Bucket
1. Create a bucket named `sheikh-zabuur-audio-catalog` in Cloudflare R2.
2. Bind a custom domain (e.g. `audio.sheikhzabur.com`) to the bucket for global zero-cost egress.

### B. Configure CORS Policy
Ensure the bucket permits presigned browser PUT uploads and Range requests for audio streaming:
```json
[
  {
    "AllowedOrigins": [
      "https://admin.sheikhzabur.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Accept-Ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 6. Admin Account Provisioning & Emergency Password Reset

### A. Bootstrapping Super Admin Account
If deploying on a fresh database, create the initial Super Admin account using the bootstrap script:
```bash
ADMIN_EMAIL="admin@sheikhzabur.com" \
ADMIN_PASSWORD="SecureSuperPassword123!" \
ADMIN_NAME="Primary Administrator" \
npx tsx scripts/bootstrap-admin.ts
```

### B. Emergency Password Reset via CLI
If the Super Admin is locked out:
```bash
ADMIN_EMAIL="admin@sheikhzabur.com" \
ADMIN_PASSWORD="NewTemporaryPassword456!" \
npx tsx scripts/bootstrap-admin.ts
```
The script updates the existing user, resets `failedLoginAttempts: 0`, and clears `lockedUntil`.

---

## 7. Catalog Compilation, Publishing & Rollback Runbook

### A. Publishing a New Catalog Release
1. Navigate to `/releases` in the Admin Dashboard.
2. Click **Compile Release Draft**.
3. Review pre-flight inspection metrics:
   - Total tracks (must equal or exceed 1,731).
   - Zero duplicate IDs.
   - Verification of all module and category foreign keys.
4. Select the appropriate SemVer bump (`patch`, `minor`, or `major`).
5. Enter release changelog notes (e.g., *"Added 10 new lectures to Module 3"*).
6. Click **Publish Release Now**.
7. The compiler generates `catalog.json`, writes historical archive `catalog/history/catalog-vX.Y.Z.json`, updates `catalogVersion.json`, and records an audit event.

### B. Instant One-Click Rollback
If a published catalog contains formatting issues or errors:
1. Navigate to `/releases`.
2. Locate the last stable release in the **Release History** table.
3. Click the **Rollback** button on that row.
4. Confirm the prompt.
5. The system immediately re-promotes the historical snapshot, updates `catalogVersion.json` to trigger mobile clients to re-synchronize, and records an audit entry.

---

## 8. Incident Response & Disaster Recovery

| Scenario | Severity | Action |
|---|---|---|
| Health Check returns 503 (`/api/health`) | CRITICAL | Check Neon console compute status. Verify connection pooler limits. Test connection string via `SELECT 1`. |
| Mobile app fails to sync catalog | HIGH | Verify `GET /api/v1/catalog/version` responds with valid JSON. Verify Cloudflare R2 custom domain DNS and SSL certificate. |
| Admin locked out (423 status code) | MEDIUM | Run `scripts/bootstrap-admin.ts` to clear lockouts and reset passwords. |
| Excessive 429 Rate Limit Errors | LOW/MEDIUM | Legitimate traffic surge. Adjust rate limit thresholds in `src/lib/rate-limit.ts`. |

