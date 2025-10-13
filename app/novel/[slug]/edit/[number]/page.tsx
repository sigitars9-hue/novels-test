"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Editor from "@/components/RichEditor";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
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
  const slug = params?.slug as string;
  const number = Number(params?.number);

  const [session, setSession] = useState<any>(null);
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [form, setForm] = useState({ title: "", content: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Ambil user
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  // Ambil novel & chapter
  useEffect(() => {
    if (!slug || !Number.isFinite(number)) return;

    (async () => {
      const { data: n, error: e1 } = await supabase
        .from("novels")
        .select("*")
        .eq("slug", slug)
        .single();
      if (e1) { setErr(e1.message); return; }
      setNovel(n as any);

      if (n?.id) {
        const { data: c, error: e2 } = await supabase
          .from("chapters")
          .select("*")
          .eq("novel_id", n.id)
          .eq("number", number)
          .single();
        if (e2) { setErr(e2.message); return; }
        setChapter(c as any);
        setForm({ title: c?.title || "", content: c?.content || "" });
      }
    })();
  }, [slug, number]);

  const isOwner = useMemo(
    () => !!(session?.user?.id && novel?.author_id === session.user.id),
    [session?.user?.id, novel?.author_id]
  );

  async function save() {
    setErr(null);
    if (!isOwner) { setErr("Anda bukan author novel ini."); return; }
    if (!chapter?.id) { setErr("Chapter tidak ditemukan."); return; }
    if (!form.title.trim()) { setErr("Judul tidak boleh kosong."); return; }

    setBusy(true);
    const { error } = await supabase
      .from("chapters")
      .update({ title: form.title, content: form.content })
      .eq("id", chapter.id);
    setBusy(false);

    if (error) { setErr(error.message); return; }

    router.push(`/read/${slug}/${number}`); // arahkan ke pembaca
  }

  async function removeChapter() {
    if (!isOwner || !chapter?.id) return;
    if (!confirm("Hapus bab ini? Tindakan tidak dapat dibatalkan.")) return;
    setBusy(true);
    const { error } = await supabase.from("chapters").delete().eq("id", chapter.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    router.push(`/novel/${slug}`);
  }

  if (!novel || !chapter) {
    return (
      <div>
        <TopBar />
        <main className="mx-auto max-w-3xl px-4 py-6">Memuat…</main>
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
          <Link
            href={`/novel/${slug}`}
            className="text-sm text-sky-400 hover:underline"
          >
            ← Kembali ke novel
          </Link>
        </div>

        {!isOwner && (
          <div className="mt-3 rounded-lg border border-white/10 p-3" style={{ background: "var(--card)" }}>
            Anda bukan author novel ini, perubahan tidak diizinkan.
          </div>
        )}

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="block text-xs text-[color:var(--muted)]">Judul Bab</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
            placeholder="Judul bab"
            disabled={!isOwner}
          />

          <label className="block text-xs text-[color:var(--muted)]">Konten</label>
          {isOwner ? (
            <Editor value={form.content} setValue={(v) => setForm({ ...form, content: v })} />
          ) : (
            <textarea
              value={form.content}
              readOnly
              className="h-72 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
              placeholder="Isi bab…"
            />
          )}

          {chapter.updated_at && (
            <div className="text-xs text-[color:var(--muted)]">
              Terakhir diubah: {new Date(chapter.updated_at).toLocaleString()}
            </div>
          )}

          {err && <div className="text-sm text-red-400">{err}</div>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={!isOwner || busy}
              className="rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 px-4 py-2 text-sm font-semibold"
            >
              {busy ? "Menyimpan…" : "Simpan Perubahan"}
            </button>

            <button
              type="button"
              onClick={removeChapter}
              disabled={!isOwner || busy}
              className="rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-60 px-4 py-2 text-sm"
            >
              Hapus Bab
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
