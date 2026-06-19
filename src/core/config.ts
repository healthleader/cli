/**
 * Public connection config. The anon key is public by design — it is already
 * embedded in the HealthLeader.ai website source and is gated server-side by
 * Row-Level Security (status='live') plus the column allowlist in fields.ts.
 * No secrets live in this repo.
 */
export const SUPABASE_URL =
  process.env.HEALTHLEADER_SUPABASE_URL ?? "https://vjwlrowighjvvnmpjdvr.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.HEALTHLEADER_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqd2xyb3dpZ2hqdnZubXBqZHZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5NDUsImV4cCI6MjA4MDk5ODk0NX0.H51Xe0zxTlpFE-45qhE0Qm9Xv7vSXZ4PtZZuN48prRI";

/** PostgREST resource. After Phase 0 RLS hardening this points at the public view. */
export const TABLE = process.env.HEALTHLEADER_TABLE ?? "conferences";

export const PKG_VERSION = "0.1.0";
