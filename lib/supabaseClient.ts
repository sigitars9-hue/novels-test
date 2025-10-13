"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Gunakan singleton supaya tidak membuat banyak instance saat Fast Refresh/HMR.
 * Ini juga memastikan `persistSession` bekerja stabil di browser.
 */
let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (cek Environment Variables)."
    );
  }

  _client = createClient(url, anon, {
    auth: {
      /** simpan sesi di localStorage agar tidak hilang saat refresh */
      persistSession: true,
      /** refresh token otomatis */
      autoRefreshToken: true,
      /** perlu untuk menangani redirect OAuth dari Google */
      detectSessionInUrl: true,
      /** kustom key supaya tidak bentrok dgn app lain di domain yg sama */
      storageKey: "ov-auth",
      /** (opsional) pakai PKCE untuk OAuth modern */
      flowType: "pkce",
    },
    // (opsional) kecilkan trafik event realtime
    realtime: { params: { eventsPerSecond: 5 } },
  });

  return _client;
}

/** export default-style agar import-existing tetap jalan */
export const supabase = getSupabaseClient();
