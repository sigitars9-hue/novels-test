"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Editor from "@/components/RichEditor";
import { Loader2, ArrowLeft, Save, Eye, Trash2 } from "lucide-react";

/* ───────────────── Types ───────────────── */
type Novel = {
  id: string;
  slug: string;
  title: string;
  author_id: string;
};

type Chapter = {
  id: string;
  novel_id: string;
  number: number;
  title: string;
  content: string | null;
  updated_at?: string | null;
};

/* ───────────────── Page ───────────────── */
export default function EditChapterPage() {
  const router = useRouter();
  const params = useParams(); // { slug, number }
  const slug = String(params?.slug || "");
  const number = Number(params?.number);

  const [session, setSession] = useState<any>(null);
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [form, setForm] = useState({ title: "", content: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState<number>(0);

  // Ambil session (sama seperti halaman Write)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  const isOwner = useMemo(
    () => !!(session?.user?.id && novel?.author_id === session.user.id),
    [session?.user?.id, novel?.author_id]
  );

  const loadData = useCallback(async () => {
    if (!slug || !Number.isFinite(number)) return;
    setLoading(true);
    setErr(null);
    try {
      // Novel by slug
      const { data: n, error: e1 } = await supabase
        .from("novels")
        .select("id, slug, title, author_id")
        .eq("slug", slug)
        .single();
      if (e1) throw e1;
      setNovel(n as Novel);

      // Chapter by (novel_id, number)
      const { data: c, error: e2 } = await supabase
        .from("chapters")
        .select("id, novel_id, number, title, content, updated_at")
        .eq("novel_id", (n as Novel).id)
        .eq("number", number)
        .single();
      if (e2) throw e2;

      const chap = c as Chapter;
      setChapter(chap);
      setForm({
        title: chap?.title || "",
        content: chap?.content ?? "",
      });
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, [slug, number]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function save() {
    setErr(null);
    if (!isOwner) {
      setErr("Anda bukan author novel ini.");
      return;
    }
    if (!chapter?.id) {
      setErr("Chapter tidak ditemukan.");
      return;
    }

    const titleTrim = (form.title || "").trim();
    const finalTitle = titleTrim.length > 0 ? titleTrim : `Bab ${number}`;
    const finalContent = form.content ?? "";

    setBusy(true);
    const { error } = await supabase
      .from("chapters")
      .update({ title: finalTitle, content: finalContent })
      .eq("id", chapter.id);
    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }
    setSavedTick((t) => t + 1);
  }

  async function removeChapter() {
    setErr(null);
    if (!isOwner || !chapter?.id) return;
    if (!confirm("Hapus bab ini? Tindakan tidak dapat dibatalkan.")) return;

    setBusy(true);
    const { error } = await supabase.from("chapters").delete().eq("id", chapter.id);
    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }
    router.push(`/novel/${slug}`);
  }

  /* ─────────────── UI mirip halaman WRITE: fullscreen, tanpa navbar ─────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto w-[min(900px,95vw)] px-4 py-8">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
          </div>
        </main>
      </div>
    );
  }

  if (!novel || !chapter) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto w-[min(900px,95vw)] px-4 py-8">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {err ?? "Data tidak ditemukan."}
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
      {/* Header minimal ala Write */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex w-[min(1000px,96vw)] items-center gap-2 px-3 py-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>

          <div className="ml-2 truncate text-sm text-zinc-300">
            Edit Bab {number} • <span className="text-zinc-400">{novel.title}</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/read/${slug}/${number}`}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              <Eye className="h-4 w-4" /> Pratinjau
            </Link>
            <button
              onClick={save}
              disabled={!isOwner || busy}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold hover:bg-sky-500 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </button>
          </div>
        </div>
      </header>

      {/* Body editor ala Write */}
      <main className="mx-auto w-[min(1000px,96vw)] px-3 py-5">
        {!isOwner && (
          <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            Anda bukan author novel ini, perubahan tidak diizinkan.
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_0_0_1px_rgb(255,255,255,0.02)]">
          <label className="mb-1 block text-xs text-zinc-400">Judul Bab</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-600"
            placeholder={`Judul bab (mis. Bab ${number})`}
            disabled={!isOwner || busy}
          />

          <div className="mt-4">
            <label className="mb-1 block text-xs text-zinc-400">Konten</label>
            {isOwner ? (
              <Editor
                value={form.content}
                setValue={(v) => setForm({ ...form, content: v })}
              />
            ) : (
              <textarea
                value={form.content}
                readOnly
                className="h-72 w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm"
                placeholder="Isi bab…"
              />
            )}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
            <div>
              {chapter.updated_at && (
                <>Terakhir diubah: {new Date(chapter.updated_at).toLocaleString()}</>
              )}
              {savedTick > 0 && (
                <span className="ml-3 text-emerald-400">Tersimpan ✓</span>
              )}
            </div>
            {err && <div className="text-red-400">{err}</div>}
          </div>
        </div>
      </main>

      {/* Bottom action bar ala Write */}
      <div className="sticky bottom-0 z-40 border-t border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex w-[min(1000px,96vw)] items-center justify-between gap-3 px-3 py-3">
          <div className="text-xs text-zinc-400">
            Mengedit: <span className="text-zinc-300">{novel.title}</span> • Bab {number}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={removeChapter}
              disabled={!isOwner || busy}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" /> Hapus
            </button>
            <button
              onClick={save}
              disabled={!isOwner || busy}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold hover:bg-sky-500 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Perubahan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
