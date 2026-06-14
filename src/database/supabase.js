import { createClient } from '@supabase/supabase-js';

// Inicializa o cliente do Supabase utilizando as variáveis de ambiente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);