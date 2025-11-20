// src/services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ztjtczlwjbxtxdgbpoub.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0anRjemx3amJ4dHhkZ2Jwb3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MzY3ODAsImV4cCI6MjA3OTExMjc4MH0.hh8QPr0mZT5MMSToj6Dbf-u81M3i28ciEde4Ok4WChk';


if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase: faltan SUPABASE_URL o SUPABASE_ANON_KEY');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
  },
});
