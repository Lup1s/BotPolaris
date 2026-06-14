import { createClient } from '@supabase/supabase-js';

// Inicializa o cliente do Supabase utilizando as variáveis de ambiente
// Utilizamos um valor de "estepe" para evitar crash imediato na importação, deixando o env.js avisar adequadamente.
const supabaseUrl = process.env.SUPABASE_URL || 'https://ausente.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'ausente';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);