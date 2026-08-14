// Core DB row types, mirrored from supabase/schema.sql

export interface Upload {
  id: string
  filename: string
  sheet_type: 'closed' | 'pipeline' | 'both'
  uploaded_by: string
  uploaded_at: string
  closed_count: number
  pipeline_count: number
}

export interface ClosedLoan {
  id: string
  upload_id: string | null
  unique_key: string
  funding_close_date: string | null
  loan_officer: string | null
  loan_processor: string | null
  loan_amount: number | null
  interest_rate: number | null
  date_file_started: string | null
  lock_date: string | null
  milestone_date_submittal: string | null
  milestone_date_completion: string | null
  current_milestone: string | null
  borrower_first_name: string | null
  borrower_last_name: string | null
  property_address: string | null
  property_city: string | null
  property_state: string | null
  property_zip: string | null
  loan_channel: string | null
  loan_type: string | null
  loan_program: string | null
  referral_source: string | null
  est_closing_date: string | null
  created_at: string
}

export interface PipelineLoan {
  id: string
  upload_id: string | null
  loan_officer: string | null
  loan_processor: string | null
  loan_amount: number | null
  interest_rate: number | null
  date_file_started: string | null
  lock_date: string | null
  milestone_date_submittal: string | null
  milestone_date_completion: string | null
  current_milestone: string | null
  borrower_first_name: string | null
  borrower_last_name: string | null
  property_address: string | null
  property_city: string | null
  property_state: string | null
  property_zip: string | null
  loan_channel: string | null
  loan_type: string | null
  loan_program: string | null
  referral_source: string | null
  est_closing_date: string | null
  created_at: string
}

export type ProjectionMode = 'auto_milestone' | 'manual'

export interface ProjectionSettings {
  id: string
  name: string
  is_active: boolean
  mode: ProjectionMode
  included_milestones: string[]
  confidence_by_milestone: Record<string, number>
  include_past_est_date: boolean
  include_no_est_date: boolean
  weight_by_confidence: boolean
  description: string | null
  created_at: string
  updated_at: string
}

export interface ProjectionOverride {
  id: string
  pipeline_loan_id: string
  projection_month: string
  included: boolean
  notes: string | null
  created_at: string
}

export interface ProjectionMonthNote {
  id: string
  projection_month: string
  notes: string | null
  updated_at: string
}

// Milestone funnel — canonical order, early -> funded
export const MILESTONE_ORDER = [
  'Application',
  'Processing',
  'Submittal',
  'Cond. Approval',
  'Approval',
  'CD Ready',
  'CD Out',
  'Ready for Docs',
  'Docs Out',
  'Funding',
  'Shipping',
  'Purchasing',
  'Completion',
] as const

export type Milestone = (typeof MILESTONE_ORDER)[number]

export const LOAN_TYPES = ['Conventional', 'FHA', 'VA', 'HELOC', 'FarmersHomeA', 'Other'] as const
export const LOAN_CHANNELS = ['Banked - Retail', 'Brokered'] as const

// Filter shape shared between Zustand store and API query builders
export interface DashboardFilters {
  dateFrom: string | null
  dateTo: string | null
  datePreset: 'MTD' | 'QTD' | 'YTD' | 'L12M' | 'ALL' | 'CUSTOM'
  loanOfficers: string[]
  processors: string[]
  states: string[]
  cities: string[]
  loanTypes: string[]
  channels: string[]
  amountMin: number | null
  amountMax: number | null
  loanPrograms: string[]
  referralSources: string[]
}

export interface KPISummary {
  totalFiles: number
  totalFilesDelta: number
  totalVolume: number
  totalVolumeDelta: number
  avgLoanSize: number
  avgInterestRate: number
  activePipeline: number
  peakMonth: { month: string; count: number } | null
}

export interface UploadApiResponse {
  closedTotal: number
  closedNew: number
  closedSkipped: number
  pipelineCount: number
  uploadId: string
}
