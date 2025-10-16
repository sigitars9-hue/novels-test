"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Editor from "@/components/RichEditor";
import {
  Loader2,
  ArrowLeft,
  Send,
  Info,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
} from "lucide-react";

/* ───────────────── Types ───────────────── */
type Msg = { type: "success" | "error" | "info"; text: string };
type NovelLite = { id: string; title: string; cover_url: string | null; tags: string[] | null };

/* ───────────────── Page ───────────────── */
export default function WriteChapterClient() {
  const router = useRouter();
  const params = useSearchParams();
  const novelId = params.get("novel_id");

  // form (samakan pola dgn edit: { title, content })
  const [number, setNumber] = useState<number | "">("");
  const [form, setForm] = useState({ title: "", content: "" });

  // ui/meta
  const [novel, setNovel] = useState<NovelLite | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyMeta, setBusyMeta] = useState(true);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // session ringan (untuk menampilkan email)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  // load meta novel + next number (mirip sebelumnya, tapi rapikan state)
  useEffect(() => {
    let alive = true;
    (async () => {
      setBusyMeta(true);
      try {
        if (!novelId) {
          setBusyMeta(false);
          return;
        }

        const { data: n } = await supabase
          .from("novels")
          .select("id, title, cover_url, tags")
          .eq("id", novelId)
          .maybeSingle();

        if (!alive) return;
        setNovel((n as any) || null);

        const { data: nums } = await supabase
          .from("chapters")
          .select("number")
          .eq("novel_id", novelId)
          .order("number", { ascending: false })
          .limit(1);

        if (!alive) return;

        if (nums && nums.length && typeof nums[0].number === "number") {
          setNumber((nums[0].number as number) + 1);
        } else {
          setNumber(1);
        }
      } catch (e: any) {
        setMsg({ type: "error", text: e?.message || "Gagal memuat metadata novel." });
        if (number === "") setNumber(1);
      } finally {
        if (alive) setBusyMeta(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novelId]);

  const resetForm = () => {
    setForm({ title: "", content: "" });
    if (typeof number === "number") setNumber(number + 1);
  };

  async function handleSubmit() {
    setMsg(null);

    if (!novelId) {
      setMsg({ type: "error", text: "novel_id tidak ditemukan. Buka dari halaman metadata." });
      return;
    }
    if (!number || Number.isNaN(Number(number)) || Number(number) <= 0) {
      setMsg({ type: "error", text: "Nomor bab wajib diisi dan harus > 0." });
      return;
    }

    const plain = (form.content || "").replace(/<[^>]+>/g, "").trim(); // jaga2 jika ada tag
    if (plain.length < 20) {
      setMsg({ type: "error", text: "Konten terlalu pendek (min. ±20 karakter)." });
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("Kamu belum login.");

      // pastikan profil ada (sama seperti sebelumnya)
      const { error: rpcErr } = await supabase.rpc("ensure_profile");
      if (rpcErr) throw new Error(rpcErr.message || "Gagal memastikan profil.");

      const payload = {
        novel_id: novelId,
        number: Number(number),
        title: (form.title || "").trim() || null,
        content: form.content || null,          // simpan apa adanya (MD/HTML ringan)
        content_text: plain.slice(0, 4000) || null,
        status: "pending",
        author_id: user.id,
      };

      const { error } = await supabase.from("submission_chapters").insert(payload);
      if (error) throw new Error(error.message);

      setMsg({ type: "success", text: "Bab berhasil diajukan. Menunggu persetujuan admin." });
      resetForm();
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Gagal mengajukan bab." });
    } finally {
      setSubmitting(false);
    }
  }

  const novelTitle = useMemo(() => novel?.title ?? "(Novel tidak ditemukan)", [novel?.title]);

  /* ─────────────── Loading awal ─────────────── */
  if (busyMeta) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
          <div className="mx-auto flex w-[min(1000px,96vw)] items-center gap-2 px-3 py-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" /> Kembali
            </button>
            <div className="ml-2 truncate text-sm text-zinc-300">
              Tulis Bab Baru • <span className="text-zinc-400">{novelTitle}</span>
            </div>
          </div>
        </header>
        <main className="mx-auto w-[min(1000px,96vw)] px-3 py-6">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header minimal – mengikuti edit bab */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex w-[min(1000px,96vw)] items-center gap-2 px-3 py-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>

          <div className="ml-2 truncate text-sm text-zinc-300">
            Tulis Bab Baru {typeof number === "number" ? `#${number}` : ""} •{" "}
            <span className="text-zinc-400">{novelTitle}</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* (Opsional) Tambah tombol pratinjau jika kamu punya route preview */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !novelId}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold hover:bg-sky-500 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Ajukan
            </button>
          </div>
        </div>
      </header>

      {/* Badges/alerts ala edit */}
      <main className="mx-auto w-[min(1000px,96vw)] px-3 py-5">
        {/* Info bar seperti edit */}
        <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-sky-300" />
            <span>
              Status awal <span className="font-semibold text-sky-300">pending</span>. Konten akan ditinjau moderator sebelum tayang.
              {userEmail ? <> &nbsp;•&nbsp; Masuk sebagai <span className="text-zinc-300">{userEmail}</span></> : null}
            </span>
          </div>
        </div>

        {novelId ? (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
            {novel?.cover_url ? (
              <img
                src={novel.cover_url}
                alt=""
                className="h-12 w-9 rounded border border-white/10 object-cover"
              />
            ) : (
              <div className="grid h-12 w-9 place-items-center rounded border border-white/10 bg-white/5 text-[10px] text-zinc-400">
                No Cover
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{novelTitle}</div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {(novel?.tags || []).map((t) => (
                  <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="ml-auto text-xs text-zinc-400">
              <BookOpen className="mr-1 inline h-3.5 w-3.5" />
              ID: {novelId.slice(0, 8)}…
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>
                <span className="font-semibold">novel_id</span> tidak ada. Buka dari halaman metadata novel agar parameter ikut terisi.{" "}
                <Link href="/write" className="underline">Kembali ke metadata</Link>
              </span>
            </div>
          </div>
        )}

        {/* Card utama — samakan feel dengan edit */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_0_0_1px_rgb(255,255,255,0.02)]">
          <div className="grid gap-3 sm:grid-cols-[140px,1fr]">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Nomor Bab</label>
              <input
                type="number"
                min={1}
                value={number}
                onChange={(e) => setNumber(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="1"
                className="w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Judul Bab (opsional)</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={typeof number === "number" ? `Mis. Bab ${number}` : "Judul bab"}
                className="w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs text-zinc-400">Konten</label>
            {/* Pakai Editor yang sama dengan edit */}
            <Editor
              value={form.content}
              setValue={(v) => setForm({ ...form, content: v })}
            />
          </div>

          {msg && (
            <div
              className={[
                "mt-4 rounded-xl border p-3 text-sm",
                msg.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : msg.type === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : "border-white/10 bg-zinc-900/60",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                {msg.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : msg.type === "error" ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Info className="h-4 w-4" />
                )}
                <span>{msg.text}</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom action bar — seragam dengan edit */}
      <div className="sticky bottom-0 z-40 border-t border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex w-[min(1000px,96vw)] items-center justify-between gap-3 px-3 py-3">
          <div className="text-xs text-zinc-400">
            Menulis: <span className="text-zinc-300">{novelTitle}</span>
            {typeof number === "number" ? <> • Bab {number}</> : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetForm}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-60"
            >
              Reset
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !novelId}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold hover:bg-sky-500 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Ajukan Bab
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
