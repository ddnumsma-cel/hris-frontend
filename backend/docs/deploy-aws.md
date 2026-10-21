# Moving MSMA HRIS to AWS (plan)

Status: **proposed**, not built. Today everything runs on one laptop (`pnpm dev`), and `pnpm share` puts a copy online
temporarily. This page is the simplest AWS setup that fits ~180 employees, 3 sites, and a few HR/payroll users, and that a
small team can run.

## Region

There is no full AWS Region in the Philippines yet (a Manila **Local Zone** exists, and a full region has been proposed
but not built). Use **Asia Pacific (Singapore), `ap-southeast-1`**: the nearest full region, with every service below.
Revisit when a Philippine region opens.

Data Privacy Act: personnel data stored in Singapore is a cross-border transfer. The Firm/DPO should confirm the privacy
notice, the NPC registration and the agreement with AWS (AWS Data Processing Addendum) before real data is loaded.

## Architecture (start small)

```
 Phones (Expo app) ─┐
 Browsers ──────────┼─ HTTPS ─► CloudFront or ALB (ACM certificate, WAF rate limits)
 ZKTeco terminals ──┘ (site VPN / IP allow-list for /iclock)
                                   │
                    ECS Fargate (or 1 EC2 with Docker Compose to start)
                    ├─ web  (Next.js, `next start`)      /api/* ─► api
                    └─ api  (NestJS, node dist/main.js)
                         │                    │
             RDS PostgreSQL 16          S3 bucket (201 documents)
             (Multi-AZ later,           private, SSE-KMS, versioning,
              automated backups,        Block Public Access,
              encryption at rest)       Object Lock for retention (later)
                         │
      Secrets Manager / SSM Parameter Store: DATABASE_URL, JWT_SECRET
      CloudWatch Logs + alarms · AWS Backup (RDS + S3) · SES for e-mail notices (later)
```

| Piece       | Choice                                                                                                 | Why                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| App servers | **Step 1:** one EC2 (t4g.medium) running Docker Compose. **Step 2:** ECS Fargate, 2 tasks              | Step 1 is closest to today's laptop; Step 2 removes server patching and survives one task failing |
| Database    | RDS for PostgreSQL 16, db.t4g.small, 7–35 day backups, encrypted                                       | Managed backups and point-in-time restore; same Postgres version as Docker today                  |
| Documents   | S3, one private bucket, SSE-KMS, versioning                                                            | Replaces `LocalDiskStorage` (see below). Scans never touch the database                           |
| HTTPS       | ACM certificate on CloudFront or an Application Load Balancer                                          | Free certificates, automatic renewal                                                              |
| Secrets     | Secrets Manager (or SSM Parameter Store)                                                               | No `.env` file on servers                                                                         |
| Mobile      | EAS Build → Google Play internal testing + TestFlight; `EXPO_PUBLIC_API_URL=https://hris.<domain>/api` | Replaces Expo Go                                                                                  |

Rough cost for Step 1 in Singapore: in the order of **US$60–120 per month** (EC2 + RDS + S3 + data transfer). Check the
AWS Pricing Calculator for current prices before budgeting.

## What changes in the code

1. **Documents → S3.** Add `S3DocumentStorage` implementing `DocumentStorage` (`apps/api/src/documents/document-storage.ts`)
   with `@aws-sdk/client-s3`, and bind it in `documents.module.ts` when `DOCUMENT_STORAGE=s3`. Keys stay the same
   (`<employeeId>/<documentId>.pdf`). Optionally serve downloads with short-lived presigned URLs after the access check
   and audit log entry.
2. **Sessions.** Move the web token from localStorage to an httpOnly cookie (or Better Auth behind `AuthService`), add MFA
   for HR/payroll/system admins, and keep the login throttle in Redis/ElastiCache or the database once there are 2+ API tasks.
3. **Config.** Read `DATABASE_URL`, `JWT_SECRET` from Secrets Manager (or inject as ECS secrets). Run `prisma migrate
deploy` as a one-off task on each release. Never run the seed in production.
4. **Terminals.** `/iclock` from the sites through a site-to-site VPN or an IP allow-list on the load balancer.
5. **Monitoring.** CloudWatch alarms on 5xx rate, CPU, RDS storage and free memory; a daily restore test of the backup
   into a scratch database (monthly at least).

## Order of work

1. Confirm payroll rates and 201 retention periods with the Firm; privacy notice and NPC registration.
2. Buy/choose the domain; create the AWS account with MFA on root, IAM Identity Center users, a budget alert.
3. Build Step 1 (EC2 + RDS + S3 + ACM) with a staging copy on synthetic data; move the team from `pnpm share` to staging.
4. S3 storage, cookie sessions, backups and alarms; then load real data (migration from the current Excel/system).
5. Step 2 (Fargate, 2 tasks), CI/CD from GitHub, EAS builds for the app stores.
