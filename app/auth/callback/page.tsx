"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
 * Halaman callback OAuth:
 * - HARUS client component + dibungkus <Suspense>
 * - Tukar `?code=` -> session via exchangeCodeForSession
 * - Redirect ke /profile saat sukses
 */
function CallbackClient() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const code = params.get("code");
    const err = params.get("error_description") || params.get("error_code");

    if (err) {
      console.error("OAuth error:", err);
      router.replace("/?auth=error");
      return;
    }

    if (!code) {
      router.replace("/");
      return;
    }

    supabase.auth
      .exchangeCodeForSession(window.location.href)
      .then(({ error }) => {
        if (error) {
          console.error("Exchange error:", error);
          router.replace("/?auth=error");
          return;
        }
        router.replace("/profile");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm">
        Menautkan akun…
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Memproses login…</div>}>
      <CallbackClient />
    </Suspense>
  );
}
