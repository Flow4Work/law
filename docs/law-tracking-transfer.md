# LAW tracking deployment gate

This branch is prepared locally. It has NOT been deployed or transferred.

## Storage

- New production events, location snapshots and login limits use a dedicated LAW Postgres database through the server-only `LEGAL_ACTIVITY_DATABASE_URL`.
- Apply `migrations/001-private-activity.sql` explicitly to that dedicated database before deploying. No request or build performs schema changes.
- Event bodies, questions, visitor IDs and raw IPs retain AES-256-GCM encryption with the existing `LEGAL_CONNECTION_SECRET`. Keep the exact existing secret, administrator path and password hash during transfer.
- The database role is server-only. Tables have RLS enabled; PUBLIC receives no schema/table/function privileges. Use the schema-owning server role and never expose its URL in client variables.
- Event IDs have a unique constraint. Collection has no automatic retry, polling or Blob fallback. Missing production database configuration returns an explicit failure, so this branch must not be deployed before provisioning.
- Non-Vercel development can use the encrypted local journal. It never substitutes ephemeral files for production persistence.

## Historical records

- Existing Blob objects are not changed or deleted. Project transfer and Blob store transfer are separate operations.
- The authenticated console's historical view reads one selected date at a time, with explicit pagination. Each page has a 1 MiB preflight/stream limit and at most 20 overflow downloads plus one listing. Immutable objects and pages are cached; concurrent reads coalesce.
- Historical statistics describe the current page. Database statistics describe the selected entire period. Full historical-period aggregation requires a separately reviewed, bounded import after measuring the existing store and available quota; no bulk import was performed.
- Stored historical regional evidence remains in the encrypted original records. Existing Blob location-override files have not been imported into Postgres.

## Verified locally

- `npm test`: 122 checks, including disk-backed isolated Postgres persistence/reopen, encrypted payloads, site separation, cursor pagination, duplicate IDs, location snapshots, login limits, archive budgets and unauthenticated history denial.
- `npm run typecheck` and `npm run build`.
- Built-in-browser QA: visitor/settings/example/question/answer collection, admin login and statistics, refresh/period change, and conversation/map restoration.
- `node tests/qa-local-activity.cjs`: loopback-only HTTP integration with QA credentials; validates malformed/oversized requests, invalid origin/authentication, idempotency and region retention.
- Old roadmap tests expected a single initially revealed step, but the unchanged implementation already reveals three. Only those stale expectations and the native-TS test resolver were corrected.

## External execution still pending

1. Obtain the pending action-time approval for Neon/Vercel Marketplace terms and account-information sharing. Only the free dedicated database has been authorized; no paid plan, trial, automatic upgrade or broader account access is authorized.
2. Provision in `issuezipkr-1873s-projects` (`team_n25hN11tmpiUQJM74tdCNA5z`), apply schema and configure the dedicated URL without printing credentials.
3. Inspect official LAW-only Project Transfer eligibility. Source: `flow4works-projects`, `team_a2oL06QqTbWTEVpbSBj3n8hX`, LAW `prj_qew7CUsJ9OUKpRX9TC15KSRlW4D4`. Verify preservation of `law-lake-theta.vercel.app`, encrypted secrets, Git link and Blob access before execution.
4. Keep source CLI authentication separate from destination authentication. The source CLI remains `flow4work`; the built-in browser is signed into `issue.zip.kr@gmail.com` (`issuezipkr-1873`, user ID `PUq8OLHyqIk5Lfhn4lvnsR17`), confirmed Owner of the destination team.
5. Stage and verify the optimized target deployment before assigning production traffic. Confirm real DB persistence, admin access, existing API connections and archived ciphertext access. Do not delete the source project/store or unrelated resources.

The old production homepage returned HTTP 200 during preparation. No production redeployment, traffic change, transfer, Blob download or data migration was performed.
