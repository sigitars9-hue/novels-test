"use client";

import { TopBar } from "@/components/TopBar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import Editor from "@/components/RichEditor";
import { useRouter, useParams } from "next/navigation";


export default function WriteChapterPage() {
  const router = useRouter();
  const params = useParams(); // { slug }
  const slug = params?.slug as string;

  const [session, setSession] = useState<any>(null);
  const [novel, setNovel] = useState<any>(null);
  const [nextNumber, setNextNumber] = useState<number>(1);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      // ambil novel by slug
      const { data: n } = await supabase.from("novels").select("*").eq("slug", slug).single();
      setNovel(n);

      // ambil nomor bab selanjutnya
      if (n?.id) {
        const { data: rows } = await supabase
          .from("chapters")
          .select("number")
          .eq("novel_id", n.id)
          .order("number", { ascending: false })
          .limit(1);
        const last = rows?.[0]?.number ?? 0;
        setNextNumber(last + 1);
        setTitle(`Bab ${last + 1}`);
      }
    })();
  }, [slug]);

  const isOwner = session?.user?.id && novel?.author_id === session.user.id;

  async function save() {
    setErr(null);
    if (!isOwner) return setErr("Anda bukan author novel ini.");
    if (!title.trim() || !content.trim()) return setErr("Judul dan konten wajib diisi.");

    setSaving(true);
    const { error } = await supabase.from("chapters").insert({
      novel_id: novel.id,
      number: nextNumber,
      title,
      content
    });
    setSaving(false);

    if (error) {
      setErr(error.message);
      return;
    }
    // redirect ke halaman pembaca (sesuaikan rute kamu)
    router.push(`/novel/${novel.slug}?chapter=${nextNumber}`);
  }

  return (
    <div>
      <TopBar />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h2 className="text-xl font-bold">Tulis Bab Baru</h2>
        {!novel ? (
          <div className="text-sm text-[color:var(--muted)] mt-2">Memuat…</div>
        ) : !isOwner ? (
          <div className="mt-3 rounded border border-white/10 p-4" style={{ background: "var(--card)" }}>
            Anda bukan author dari novel <b>{novel.title}</b>.
          </div>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className="text-xs text-[color:var(--muted)]">Menambah bab untuk: <b>{novel.title}</b></div>
            <div className="grid grid-cols-[110px,1fr] gap-2 items-center">
              <label className="text-sm">Nomor Bab</label>
              <input value={nextNumber} readOnly className="rounded bg-white/5 border border-white/10 px-3 py-2 text-sm" />
            </div>
            <input
              value={title} onChange={(e)=> setTitle(e.target.value)}
              className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-sm"
              placeholder="Judul bab"
            />
            <Editor value={content} setValue={setContent} />
            {err && <div className="text-sm text-red-400">{err}</div>}
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-sm font-semibold"
              >
                {saving ? "Menyimpan…" : "Simpan Bab"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
