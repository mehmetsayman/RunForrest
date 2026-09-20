/**
 * Setup status — is Supabase connected, and are the tables in place?
 *
 * It answers "why is the run history empty?" in a second during a demo.
 * It runs with the anon key and does NOT create tables (the anon key cannot).
 * For the schema: scripts/setup.sql → Supabase Dashboard → SQL Editor.
 *
 * Note: Supabase is an optional layer here. Challenges, the prize pool, entry
 * fees and badges all live in the Soroban contracts; these tables hold only
 * GPS routes and challenge metadata.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Asks PostgREST for a single row; a missing table returns PGRST205. */
async function probe(table: string) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: key!, Authorization: `Bearer ${key!}` },
    cache: "no-store",
  });
  if (res.ok) return { exists: true as const };
  const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
  return {
    exists: false as const,
    code: body.code ?? String(res.status),
    message: body.message ?? `HTTP ${res.status}`,
  };
}

export async function GET() {
  if (!url || !key) {
    return NextResponse.json(
      {
        configured: false,
        message:
          "Supabase is not configured. Run history and challenge metadata are disabled; " +
          "no chain-backed feature is affected.",
      },
      { status: 200 },
    );
  }

  const [runs, meta] = await Promise.all([probe("runs"), probe("challenge_meta")]);
  const ready = runs.exists && meta.exists;

  return NextResponse.json(
    {
      configured: true,
      ready,
      project: url,
      tables: { runs, challenge_meta: meta },
      ...(ready
        ? {}
        : {
            next_step:
              "Supabase Dashboard → SQL Editor → paste and run web/scripts/setup.sql.",
          }),
    },
    { status: 200 },
  );
}
