/**
 * Supabase — GPS rotaları ve koşu geçmişi.
 *
 * İş bölümü: ZİNCİR mesafeyi, katılımı, havuzu ve rozetleri tutar (para ve
 * itibar oradadır). Supabase yalnızca rota poligonunu ve koşu detaylarını
 * tutar — binlerce GPS noktasını zincire yazmak hem anlamsız hem pahalı.
 *
 * İstemci TEMBEL kuruluyor: yapılandırma yoksa modül yüklenirken patlamak
 * yerine, çağrıldığı yerde anlaşılır bir hata veriyor. Böylece uygulama
 * Supabase olmadan da derleniyor ve zincire dayalı her özellik çalışıyor.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Koşu geçmişi özellikleri kullanılabilir mi? */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase yapılandırılmamış: NEXT_PUBLIC_SUPABASE_URL ve " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY gerekli. Koşu geçmişi devre dışı; " +
        "zincire dayalı özellikler etkilenmez.",
    );
  }
  if (!client) client = createClient(url!, anonKey!);
  return client;
}

/**
 * Supabase istemcisi. `supabase.from(...)` çağrısı, yapılandırma yoksa
 * anlaşılır bir hata fırlatır — sessizce yanlış veri döndürmez.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient();
    const value = c[prop as keyof SupabaseClient];
    return typeof value === "function" ? value.bind(c) : value;
  },
});
