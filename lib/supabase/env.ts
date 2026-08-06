// Configuration gate shared by the whole app. With no Supabase env vars the
// dashboard runs in DEMO MODE against synthetic history (lib/demo-data.ts), so
// a fresh clone is fully populated and demoable without a backend.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
