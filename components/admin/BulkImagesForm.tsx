"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ChapterOpt = { id:string; label:string };

export default function BulkImagesForm() {
  const [chapters, setChapters] = useState<ChapterOpt[]>([]);
  const [chapterId, setChapterId] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Ambil chapter terbaru (admin bisa lihat semuanya)
      const { data, error } = await supabase
        .from("chapters")
        .select("id, number, title, comic_id, comics!inner(title)")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (!error && data) {
        const opts = data.map((c:any) => ({
          id: c.id,
          label: `[${c.comics.title}] Ch ${c.number} — ${c.title}`
        }));
        setChapters(opts);
      }
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
      if (!lines.length) throw new Error("Tempel minimal 1 URL gambar.");
      // ambil ord awal
      const { data: exist, error: e1 } = await supabase
        .from("images")
        .select("ord")
        .eq("chapter_id", chapterId)
        .order("ord", { ascending: false })
        .limit(1);
      if (e1) throw e1;
      let start = exist?.[0]?.ord ?? 0;

      const rows = lines.map((url, i) => ({
        chapter_id: chapterId,
        url,
        ord: start + i + 1
      }));
      const { error } = await supabase.from("images").insert(rows);
      if (error) throw error;

      setMsg(`✅ ${rows.length} gambar ditambahkan.`);
      setText("");
    } catch (err:any) {
      setMsg("❌ " + err.message);
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-white/10 p-4">
      <h3 className="text-lg font-semibold">Tambah Gambar (Batch URL)</h3>

      <select className="w-full rounded bg-zinc-900/60 p-2"
              value={chapterId} onChange={e=>setChapterId(e.target.value)}>
        <option value="">— Pilih Chapter —</option>
        {chapters.map(ch => <option key={ch.id} value={ch.id}>{ch.label}</option>)}
      </select>

      <textarea className="h-40 w-full rounded bg-zinc-900/60 p-2"
                placeholder={`Tempel URL, satu per baris…\nhttps://cdn.example/p1.jpg\nhttps://cdn.example/p2.jpg`}
                value={text} onChange={e=>setText(e.target.value)} />

      <button disabled={loading || !chapterId}
              className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500 disabled:opacity-50">
        {loading ? "Mengunggah…" : "Tambah"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </form>
  );
}
