-- Peak Finance Dashboard schema
-- Run this entire file in the Supabase SQL editor before seeding.

-- Upload tracking
create table if not exists uploads (
  id uuid default gen_random_uuid() primary key,
  filename text not null,
  sheet_type text not null check (sheet_type in ('closed', 'pipeline', 'both')),
  uploaded_by text default 'Unknown',
  uploaded_at timestamptz default now(),
  closed_count integer default 0,
  pipeline_count integer default 0
);

-- Closed / funded loans (Data sheet)
-- unique_key prevents duplicates across re-uploads
create table if not exists closed_loans (
  id uuid default gen_random_uuid() primary key,
  upload_id uuid references uploads(id) on delete set null,
  unique_key text unique not null,  -- MD5 of: funding_date|loan_officer|borrower_last|loan_amount
  funding_close_date date,
  loan_officer text,
  loan_processor text,
  loan_amount numeric,
  interest_rate numeric,
  date_file_started date,
  lock_date date,
  milestone_date_submittal date,
  milestone_date_completion date,
  current_milestone text,
  borrower_first_name text,
  borrower_last_name text,
  property_address text,
  property_city text,
  property_state text,
  property_zip text,
  loan_channel text,
  loan_type text,
  loan_program text,
  referral_source text,
  est_closing_date date,
  created_at timestamptz default now()
);

-- Pipeline / open loans (Table sheet) — always fully replaced on upload
create table if not exists pipeline_loans (
  id uuid default gen_random_uuid() primary key,
  upload_id uuid references uploads(id) on delete cascade,
  loan_officer text,
  loan_processor text,
  loan_amount numeric,
  interest_rate numeric,
  date_file_started date,
  lock_date date,
  milestone_date_submittal date,
  milestone_date_completion date,
  current_milestone text,
  borrower_first_name text,
  borrower_last_name text,
  property_address text,
  property_city text,
  property_state text,
  property_zip text,
  loan_channel text,
  loan_type text,
  loan_program text,
  referral_source text,
  est_closing_date date,
  created_at timestamptz default now()
);

-- Projection rule sets (user-configurable)
create table if not exists projection_settings (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  is_active boolean default false,
  mode text not null check (mode in ('auto_milestone', 'manual')),
  included_milestones text[] default '{}',
  confidence_by_milestone jsonb default '{}',
  include_past_est_date boolean default true,
  include_no_est_date boolean default false,
  weight_by_confidence boolean default true,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Manual projection overrides (manual mode only)
create table if not exists projection_overrides (
  id uuid default gen_random_uuid() primary key,
  pipeline_loan_id uuid references pipeline_loans(id) on delete cascade,
  projection_month text not null,  -- 'YYYY-MM'
  included boolean default true,
  notes text,
  created_at timestamptz default now(),
  unique (pipeline_loan_id, projection_month)
);

-- Per-month admin notes on the Projections tab (free-form, one row per month)
create table if not exists projection_month_notes (
  id uuid default gen_random_uuid() primary key,
  projection_month text not null unique, -- 'YYYY-MM'
  notes text,
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists idx_closed_loans_funding_date on closed_loans(funding_close_date);
create index if not exists idx_closed_loans_completion_date on closed_loans(milestone_date_completion);
create index if not exists idx_closed_loans_lo on closed_loans(loan_officer);
create index if not exists idx_closed_loans_processor on closed_loans(loan_processor);
create index if not exists idx_closed_loans_state on closed_loans(property_state);
create index if not exists idx_pipeline_loans_milestone on pipeline_loans(current_milestone);
create index if not exists idx_pipeline_loans_lo on pipeline_loans(loan_officer);
create index if not exists idx_pipeline_loans_est_close on pipeline_loans(est_closing_date);

-- RLS
alter table uploads enable row level security;
alter table closed_loans enable row level security;
alter table pipeline_loans enable row level security;
alter table projection_settings enable row level security;
alter table projection_overrides enable row level security;
alter table projection_month_notes enable row level security;

create policy "Public all" on uploads for all using (true) with check (true);
create policy "Public all" on closed_loans for all using (true) with check (true);
create policy "Public all" on pipeline_loans for all using (true) with check (true);
create policy "Public all" on projection_settings for all using (true) with check (true);
create policy "Public all" on projection_overrides for all using (true) with check (true);
create policy "Public all" on projection_month_notes for all using (true) with check (true);

-- Realtime
alter publication supabase_realtime add table uploads;

-- Seed default projection setting
insert into projection_settings (name, is_active, mode, included_milestones, confidence_by_milestone, description)
values (
  'Standard Pipeline',
  true,
  'auto_milestone',
  array['CD Ready', 'CD Out', 'Docs Out', 'Ready for Docs', 'Funding', 'Approval', 'Cond. Approval'],
  '{"CD Ready": 90, "CD Out": 90, "Docs Out": 85, "Ready for Docs": 80, "Funding": 95, "Approval": 70, "Cond. Approval": 60}',
  'Counts loans in advanced milestones toward monthly projections with confidence weights'
)
on conflict do nothing;
