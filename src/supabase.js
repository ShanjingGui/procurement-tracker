import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zfaeenvtjfzywvgpiqqb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmYWVlbnZ0amZ6eXd2Z3BpcXFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTI2MTYsImV4cCI6MjA5MDU2ODYxNn0.sltjUDaqAIR7eMxo0vD7jzNbx7-fn3cPtJlveXq-mJQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
