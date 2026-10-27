// Inlined at build time from .env by scripts/babel-plugin-inline-env.js.
declare const process: { env: { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string } };

export const env = {
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
};
