// src/services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import { SUPABASE } from '../utils/constants';

if (!SUPABASE.url || !SUPABASE.anonKey) {
  throw new Error('Faltan credenciales de Supabase en constants.ts');
}

export const supabase = createClient(SUPABASE.url, SUPABASE.anonKey, {
  auth: {
    persistSession: false,
  },
});
