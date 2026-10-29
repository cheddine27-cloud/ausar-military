# Ausar Military — `scripts/`

Operational tooling. None of these scripts ship with the production bundle.

## Pre-Demo Smoke Test

Run **before every customer demo** to verify the live deployment is healthy.

```bash
# 1. one-time setup
cp scripts/demo-smoke.env.example .env.local
# then fill in the 6 DEMO_PWD_* values from docs/PRE_CUSTOMER_DEMO_CHECKLIST.md

# 2. run before each meeting
node scripts/demo-smoke.mjs
```

**Output:**
- `🟢 GO` → all 7 sections pass, demo is ready (exit code 0)
- `🔴 NO-GO` → at least one check failed, with details on what to fix (exit code 1)

**Checks performed (~10 seconds total):**

1. Live website + login page return HTTP 200
2. All 6 demo accounts authenticate successfully via Supabase Auth
3. The active demo session (`DEMO01` by default) exists in Skikda
4. `admin_skikda` sees institution-wide data (RLS read)
5. `taher` sees only his own cohort (RLS scoping)
6. `viewer_demo` cannot UPDATE (RLS write block — defense-in-depth)
7. All 8 institution-dashboard tables respond without 5xx

**Notes:**
- Uses Supabase REST + Auth APIs only — no service_role, no direct DB access.
- `.env.local` is gitignored. Never commit real passwords.
- Safe to run from CI; exit code is the source of truth.
