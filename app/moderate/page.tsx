"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Check, X, Loader2, ShieldCheck, RefreshCcw } from "lucide-react";
import Link from "next/link";

type Sub = {
  id: string;
  novel_id: string;
  number: number;
  title: string | null;
  content_text: string | null;
  status: "pending" | "approved" | "rejected" | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  created_at: string;
  author_id: string | null;
};

export default function ModeratePage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Sub[]>([]);
  const [meAdmin, setMeAdmin] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      // 1) User
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("Harus login.");

      // 2) Admin?
      const { data: me, error: meErr } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      if (meErr) throw meErr;
      const isAdmin = !!me?.is_admin;
      setMeAdmin(isAdmin);

      // 3) Ambil pending
      // Pending didefinisikan sebagai:
      // - status = 'pending'  ATAU
      // - approved_at IS NULL dan rejected_at IS NULL
      // Non-admin: hanya lihat miliknya sendiri
      let query = supabase
        .from("submission_chapters")
        .select(
          "id, novel_id, number, title, content_text, status, approved_at, rejected_at, created_at, author_id"
        )
        .or("status.eq.pending,and(approved_at.is.null,rejected_at.is.null)")
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        query = query.eq("author_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      setRows((data as Sub[]) || []);
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat data.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(row: Sub) {
    if (!meAdmin) return alert("Bukan admin.");
    setBusyId(row.id);
    try {
      // Masukkan ke tabel chapters (pakai content_text)
      const { error: insertErr } = await supabase.from("chapters").insert({
        novel_id: row.novel_id,
        number: row.number,
        title: row.title,
        content: row.content_text, // <-- bawa isi teks
        created_at: new Date().toISOString(),
      });
      if (insertErr) throw insertErr;

      // Ubah status submission -> approved
      const { error: updErr } = await supabase
        .from("submission_chapters")
        .update({ status: "approved", approved_at: new Date().toISOString(), rejected_at: null })
        .eq("id", row.id);
      if (updErr) throw updErr;

      setRows((r) => r.filter((x) => x.id !== row.id));
    } catch (e: any) {
      alert(e?.message || "Gagal approve.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(row: Sub) {
    if (!meAdmin) return alert("Bukan admin.");
    setBusyId(row.id);
    try {
      const { error } = await supabase
        .from("submission_chapters")
        .update({ status: "rejected", rejected_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;

      setRows((r) => r.filter((x) => x.id !== row.id));
    } catch (e: any) {
      alert(e?.message || "Gagal reject.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto w-[min(980px,95vw)] px-4 py-6">
        <div className="mb-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <h1 className="text-xl font-bold">Moderasi Bab</h1>
          {!meAdmin && (
            <span className="text-sm text-amber-300">
              (Kamu bukan admin – hanya melihat milikmu sendiri)
            </span>
          )}
          <button
            onClick={load}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {err && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat antrian…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
            Tidak ada submission pending.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-zinc-400">
                      Novel ID:{" "}
                      <span className="font-mono">
                        {r.novel_id ? `${r.novel_id.slice(0, 8)}…` : "—"}
                      </span>{" "}
                      • Bab {r.number}
                    </div>
                    <div className="text-base font-semibold">{r.title || "(Tanpa judul)"}</div>
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-300/90">
                      {r.content_text || "—"}
                    </p>
                    <div className="mt-2 text-xs text-zinc-500">
                      Diajukan: {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/novel/${r.novel_id}`} // ganti ke /novel/slug jika ada
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                    >
                      Lihat Novel
                    </Link>
                    <button
                      disabled={!meAdmin || busyId === r.id}
                      onClick={() => approve(r)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {busyId === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Approve
                    </button>
                    <button
                      disabled={!meAdmin || busyId === r.id}
                      onClick={() => reject(r)}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-500 disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" />
                      Tolak
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
