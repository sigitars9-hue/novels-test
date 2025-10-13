"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import Editor from "@/components/RichEditor";
import { supabase } from "@/lib/supabaseClient";

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

    // Validasi seperti di Write: judul wajib, fallback bila kosong
    const titleTrim = (form.title || "").trim();
    const finalTitle = titleTrim.length > 0 ? titleTrim : `Bab ${number}`;
    const finalContent = form.content ?? ""; // samakan dengan Write: tidak null

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

    router.push(`/read/${slug}/${number}`);
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

  if (loading) {
    return (
      <div>
        <TopBar />
        <main className="mx-auto max-w-3xl px-4 py-6">Memuat…</main>
      </div>
    );
  }

  if (!novel || !chapter) {
    return (
      <div>
        <TopBar />
        <main className="mx-auto max-w-3xl px-4 py-6">
          {err ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {err}
            </div>
          ) : (
            "Data tidak ditemukan."
          )}
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
    <div>
      <TopBar />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            Edit Bab {number} — <span className="opacity-80">{novel.title}</span>
          </h2>
          <div className="flex items-center gap-3">
            <Link
              href={`/read/${slug}/${number}`}
              className="text-sm text-zinc-300 hover:underline"
            >
              Pratinjau
            </Link>
            <Link href={`/novel/${slug}`} className="text-sm text-sky-400 hover:underline">
              ← Kembali ke novel
            </Link>
          </div>
        </div>

        {!isOwner && (
          <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            Anda bukan author novel ini, perubahan tidak diizinkan.
          </div>
        )}

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) save();
          }}
        >
          <label className="block text-xs text-zinc-400">Judul Bab</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
            placeholder={`Judul bab (mis. Bab ${number})`}
            disabled={!isOwner || busy}
          />

          <label className="block text-xs text-zinc-400">Konten</label>
          {isOwner ? (
            <Editor
              value={form.content}
              setValue={(v) => setForm({ ...form, content: v })}
            />
          ) : (
            <textarea
              value={form.content}
              readOnly
              className="h-72 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              placeholder="Isi bab…"
            />
          )}

          {chapter.updated_at && (
            <div className="text-xs text-zinc-500">
              Terakhir diubah: {new Date(chapter.updated_at).toLocaleString()}
            </div>
          )}

          {err && <div className="text-sm text-red-400">{err}</div>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={!isOwner || busy}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold hover:bg-sky-500 disabled:opacity-60"
            >
              {busy ? "Menyimpan…" : "Simpan Perubahan"}
            </button>

            <button
              type="button"
              onClick={removeChapter}
              disabled={!isOwner || busy}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-60"
            >
              Hapus Bab
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
