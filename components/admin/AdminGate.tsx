"use client";

import { useEffect, useState, PropsWithChildren } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminGate({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMsg("Kamu belum login.");
        setLoading(false);
        return;
      }
      // ⚠️ Wrapper is_admin() tanpa argumen bergantung pada auth.uid()
      const { data, error } = await supabase.rpc("is_admin", {} as any);
      if (error) {
        setMsg("Gagal cek admin: " + error.message);
        setLoading(false);
        return;
      }
      setOk(!!data);
      if (!data) setMsg("Akses ditolak. Admin only.");
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-6">Memeriksa peran…</div>;
  if (!ok) return <div className="p-6 text-red-400">{msg}</div>;
  return <>{children}</>;
}
