-- Peak Finance Dashboard — Financials add-on (experimental, isolated)
-- Run this AFTER supabase/schema.sql. Purely additive: no existing tables are touched.
-- To revert this entire feature: drop these two tables, nothing else is affected.
--   drop table if exists gl_transactions;
--   drop table if exists financials_uploads;

create table if not exists financials_uploads (
  id uuid default gen_random_uuid() primary key,
  filename text not null,
  period_start date,
  period_end date,
  uploaded_by text default 'Unknown',
  uploaded_at timestamptz default now(),
  transaction_count integer default 0,
  matched_count integer default 0,
  unmatched_count integer default 0
);

-- One row per General Ledger line item. gl_category is derived from the account code prefix:
-- 40xx = revenue, 50xx = direct loan-level expense (cost of sales), 60xx+ = company overhead.
-- amount is a normalized signed figure: (credit - debit) for revenue, (debit - credit) for expenses,
-- so it's always positive for a normal transaction regardless of the underlying debit/credit convention.
create table if not exists gl_transactions (
  id uuid default gen_random_uuid() primary key,
  upload_id uuid references financials_uploads(id) on delete cascade,
  posted_date date,
  doc_number text,
  memo text,
  vendor_name text,
  class_name text,
  gl_account_code text,
  gl_account_name text,
  gl_category text not null check (gl_category in ('revenue', 'direct_expense', 'overhead')),
  debit numeric,
  credit numeric,
  amount numeric not null,
  loan_number_ref text,
  borrower_last_name_ref text,
  property_address_ref text,
  matched_closed_loan_id uuid references closed_loans(id) on delete set null,
  match_confidence text check (match_confidence in ('high', 'medium', 'low')),
  created_at timestamptz default now()
);

create index if not exists idx_gl_transactions_upload on gl_transactions(upload_id);
create index if not exists idx_gl_transactions_matched_loan on gl_transactions(matched_closed_loan_id);
create index if not exists idx_gl_transactions_category on gl_transactions(gl_category);
create index if not exists idx_gl_transactions_posted_date on gl_transactions(posted_date);

alter table financials_uploads enable row level security;
alter table gl_transactions enable row level security;

create policy "Public all" on financials_uploads for all using (true) with check (true);
create policy "Public all" on gl_transactions for all using (true) with check (true);
