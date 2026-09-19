/**
 * Kurulum durumu — Supabase bağlı mı, tablolar yerinde mi?
 *
 * Demo sırasında "koşu geçmişi neden boş?" sorusunu saniyesinde cevaplamak için.
 * Anon anahtarla çalışır; tablo OLUŞTURMAZ (anon anahtarın yetkisi yok).
 * Şema için: scripts/setup.sql → Supabase Dashboard → SQL Editor.
 *
 * Not: Supabase burada opsiyonel bir katman. Yarışmalar, ödül havuzu, katılım
 * ücretleri ve rozetler Soroban kontratlarında; bu tablolar yalnızca GPS
 * rotalarını ve yarışma üstverisini tutuyor.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** PostgREST'e tek satır sorar; tablo yoksa PGRST205 döner. */
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
          "Supabase yapılandırılmamış. Koşu geçmişi ve yarışma üstverisi devre dışı; " +
          "zincire dayalı özelliklerin hiçbiri etkilenmez.",
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
              "Supabase Dashboard → SQL Editor → web/scripts/setup.sql dosyasını yapıştırıp çalıştırın.",
          }),
    },
    { status: 200 },
  );
}
