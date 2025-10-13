"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    // Supabase akan membaca fragment hash (?code / #access_token) dan menyimpan sesi
    // cukup panggil getSession sekali lalu redirect.
    let mounted = true;
    (async () => {
      try {
        // memaksa supabase-js mem-parsing URL
        await supabase.auth.getSession();
      } finally {
        if (!mounted) return;
        // opsional: arahkan balik ke parameter returnTo
        const returnTo = sp.get("returnTo") || "/";
        router.replace(returnTo);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router, sp]);

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="inline-flex items-center gap-2 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Menyelesaikan login…
      </div>
    </div>
  );
}
