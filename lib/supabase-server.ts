import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server-only client — bypasses RLS. Never import this from client components.
export const supabaseServer = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
})
