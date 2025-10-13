"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Editor from "@/components/RichEditor";
import { Loader2, ArrowLeft, Save } from "lucide-react";

/* ───────────────── Types ───────────────── */
type Novel = {
  id: string;
  slug: string;
  title: string;
  author_id: string;
};

/* ───────────────── Page ───────────────── */
export default function WriteChapterPage() {
  const router = useRouter();
  const params = useParams(); // { slug }
  const slug = String(params?.slug || "");

  const [session, setSession] = useState<any>(null);
  const [novel, setNovel] = useState<Novel | null>(null);
  const [nextNumber, setNextNumber] = useState<number>(1);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* Session */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  const isOwner = useMemo(
    () => !!(session?.user?.id && novel?.author_id === session.user.id),
    [session?.user?.id, novel?.author_id]
  );

  /* Load novel + next chapter number */
  const loadData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setErr(null);
    try {
      const { data: n, error: e1 } = await supabase
        .from("novels")
        .select("id, slug, title, author_id")
        .eq("slug", slug)
        .single();
      if (e1) throw e1;
      setNovel(n as Novel);

      const { data: rows, error: e2 } = await supabase
        .from("chapters")
        .select("number")
        .eq("novel_id", (n as Novel).id)
        .order("number", { ascending: false })
        .limit(1);
      if (e2) throw e2;
      const last = rows?.[0]?.number ?? 0;
      const next = last + 1;
      setNextNumber(next);
      setTitle(`Bab ${next}`);
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function save() {
    setErr(null);
    if (!isOwner) return setErr("Anda bukan author novel ini.");
    if (!novel?.id) return setErr("Novel tidak ditemukan.");

    const titleTrim = (title || "").trim();
    const finalTitle = titleTrim.length > 0 ? titleTrim : `Bab ${nextNumber}`;
    const finalContent = content ?? "";

    if (!finalContent.trim()) return setErr("Konten wajib diisi.");

    setSaving(true);
    const { error } = await supabase.from("chapters").insert({
      novel_id: novel.id,
      number: nextNumber,
      title: finalTitle,
      content: finalContent,
      created_at: new Date().toISOString(),
    });
    setSaving(false);

    if (error) {
      setErr(error.message);
      return;
    }

    router.push(`/read/${slug}/${nextNumber}`);
  }

  /* ─────────────── UI mirip halaman EDIT/WRITE: fullscreen, tanpa navbar ─────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto w-[min(1000px,96vw)] px-3 py-8">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
          </div>
        </main>
      </div>
    );
  }

  if (!novel) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto w-[min(1000px,96vw)] px-3 py-8">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {err ?? "Novel tidak ditemukan."}
          </div>
          <div className="mt-4">
            <Link href="/" className="text-sky-400 hover:underline">
              ← Kembali ke beranda
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header minimal ala Edit/Write */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex w-[min(1000px,96vw)] items-center gap-2 px-3 py-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>

          <div className="ml-2 truncate text-sm text-zinc-300">
            Tulis Bab Baru • <span className="text-zinc-400">{novel.title}</span>
          </div>

          <div className="ml-auto">
            <button
              onClick={save}
              disabled={!isOwner || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold hover:bg-sky-500 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </button>
          </div>
        </div>
      </header>

      {/* Body editor ala Edit/Write */}
      <main className="mx-auto w-[min(1000px,96vw)] px-3 py-5">
        {!isOwner && (
          <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            Anda bukan author dari novel <b>{novel.title}</b>.
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_0_0_1px_rgb(255,255,255,0.02)]">
          <div className="grid grid-cols-[110px,1fr] items-center gap-2">
            <label className="text-xs text-zinc-400">Nomor Bab</label>
            <input
              value={nextNumber}
              readOnly
              className="rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm"
            />
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs text-zinc-400">Judul Bab</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-600"
              placeholder={`Judul bab (mis. Bab ${nextNumber})`}
              disabled={!isOwner || saving}
            />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs text-zinc-400">Konten</label>
            <Editor value={content} setValue={setContent} />
          </div>

          {err && <div className="mt-3 text-sm text-red-400">{err}</div>}
        </div>
      </main>

      {/* Bottom action bar ala Edit/Write */}
      <div className="sticky bottom-0 z-40 border-t border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex w-[min(1000px,96vw)] items-center justify-between gap-3 px-3 py-3">
          <div className="text-xs text-zinc-400">
            Menambah bab untuk: <span className="text-zinc-300">{novel.title}</span> • Bab {nextNumber}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={!isOwner || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold hover:bg-sky-500 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Bab
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
