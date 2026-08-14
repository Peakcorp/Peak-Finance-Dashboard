# Peak Finance Dashboard — Setup & Deployment

## Stack
Next.js 14 (App Router) + TypeScript + Supabase (Postgres + Realtime) + Tailwind CSS + Recharts + Zustand.

## 1. Create the Supabase project
1. Create a project at https://supabase.com/dashboard (or use an existing one).
2. In the SQL Editor, run the entire contents of [`supabase/schema.sql`](supabase/schema.sql).
3. Grab your project URL and keys from Project Settings → API.

## 2. Configure environment variables
Copy `.env.example` to `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
The service role key is server-only (used by API routes and the seed script) — never expose it client-side.

## 3. Install dependencies
```bash
npm install
```

## 4. Seed the database (one-time)
1. Copy your Encompass `.xlsx` export to `scripts/data/encompass.xlsx`.
2. Run:
```bash
npm run seed
```
This parses the `Data` (closed loans) and `Table` (pipeline) sheets and loads them into Supabase, applying the same dedup rules as the upload API.

> Note: closed loans are only seeded from `Data` sheet rows where `Current Milestone = "Completion"` (with a non-null `Milestone Date - Completion`). `FUNDING CLOSE DATE` is stored for reference but is not used to decide what counts as closed — it's sparse and unreliable in the source export. Rows still at earlier milestones (e.g. `Current Milestone = "Started"`, an abandoned file) are historical noise and are skipped. All production/LO/processor/loan-type analytics are computed from this same closed-loan set.

## 5. Run locally
```bash
npm run dev
```
Visit http://localhost:3000.

## 6. Deploy to Vercel
1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Add the same three environment variables in the Vercel project settings.
4. Deploy.

## Future uploads
Once live, use the "⬆ Upload Report" button in the header to drag in any new Encompass export:
- **Closed loans** (`Data` sheet) are additive — duplicates (same funding date + LO + borrower last name + amount) are automatically skipped, only net-new rows are inserted.
- **Pipeline** (`Table` sheet) is always fully replaced with the latest snapshot on every upload.
