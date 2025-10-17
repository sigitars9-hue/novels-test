"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Comic = { id:string; title:string; slug:string };

export default function CreateChapterForm() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [comicId, setComicId] = useState("");
  const [number, setNumber] = useState<number>(1);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"private"|"unlisted"|"public">("private");
  const [pub, setPub] = useState(false);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("comics")
        .select("id,title,slug")
        .order("title", { ascending: true });
      if (!error && data) setComics(data);
    })();
  }, []);

  useEffect(() => {
    if (visibility === "unlisted" && !token) {
      setToken(crypto.randomUUID().replace(/-/g,""));
    }
  }, [visibility]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User tidak ditemukan");
      const { error } = await supabase.from("chapters").insert({
        comic_id: comicId, number, title,
        visibility, is_published: pub,
        published_at: pub ? new Date().toISOString() : null,
        unlisted_token: visibility === "unlisted" ? token : null,
        created_by: user.id
      });
      if (error) throw error;
      setMsg("✅ Chapter dibuat.");
      setTitle(""); setNumber(1); setPub(false); setVisibility("private"); setToken("");
    } catch (err:any) {
      setMsg("❌ " + err.message);
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-white/10 p-4">
      <h3 className="text-lg font-semibold">Buat Chapter</h3>

      <select className="w-full rounded bg-zinc-900/60 p-2"
              value={comicId} onChange={e=>setComicId(e.target.value)}>
        <option value="">— Pilih Komik —</option>
        {comics.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>

      <input type="number" min={1}
             className="w-full rounded bg-zinc-900/60 p-2" placeholder="Nomor (1,2,3…)"
             value={number} onChange={e=>setNumber(Number(e.target.value))} />

      <input className="w-full rounded bg-zinc-900/60 p-2" placeholder="Judul Chapter"
             value={title} onChange={e=>setTitle(e.target.value)} />

      <div className="flex gap-3">
        <div>
          <label className="text-sm opacity-80">Visibility</label>
          <select className="ml-2 rounded bg-zinc-900/60 p-2"
                  value={visibility} onChange={e=>setVisibility(e.target.value as any)}>
            <option value="private">private</option>
            <option value="unlisted">unlisted</option>
            <option value="public">public</option>
          </select>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={pub} onChange={e=>setPub(e.target.checked)} />
          <span>Publish sekarang</span>
        </label>
      </div>

      {visibility === "unlisted" && (
        <div>
          <label className="block text-sm opacity-80">Unlisted token</label>
          <input className="w-full rounded bg-zinc-900/60 p-2"
                 value={token} onChange={e=>setToken(e.target.value)} />
          <p className="text-xs opacity-70">Link baca: /read/[chapterId]?token={token}</p>
        </div>
      )}

      <button disabled={loading || !comicId}
              className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50">
        {loading ? "Menyimpan…" : "Simpan"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </form>
  );
}
