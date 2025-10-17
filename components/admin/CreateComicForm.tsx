"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function slugify(s: string) {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function CreateComicForm() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");
  const [cover, setCover] = useState("");
  const [status, setStatus] = useState<"draft"|"published"|"archived">("draft");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      const s = slug || slugify(title);
      // author_id diisi dari user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User tidak ditemukan");
      const { error } = await supabase.from("comics").insert({
        slug: s, title, description: desc, cover_url: cover || null,
        status, author_id: user.id
      });
      if (error) throw error;
      setMsg("✅ Komik dibuat.");
      setTitle(""); setSlug(""); setDesc(""); setCover("");
      setStatus("draft");
    } catch (err:any) {
      setMsg("❌ " + err.message);
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-white/10 p-4">
      <h3 className="text-lg font-semibold">Buat Komik</h3>
      <input className="w-full rounded bg-zinc-900/60 p-2" placeholder="Judul"
             value={title} onChange={e=>setTitle(e.target.value)} />
      <input className="w-full rounded bg-zinc-900/60 p-2" placeholder="Slug (opsional)"
             value={slug} onChange={e=>setSlug(e.target.value)} />
      <textarea className="w-full rounded bg-zinc-900/60 p-2" placeholder="Deskripsi"
                value={desc} onChange={e=>setDesc(e.target.value)} />
      <input className="w-full rounded bg-zinc-900/60 p-2" placeholder="Cover URL (opsional)"
             value={cover} onChange={e=>setCover(e.target.value)} />
      <div className="flex items-center gap-3">
        <label className="text-sm opacity-80">Status:</label>
        <select className="rounded bg-zinc-900/60 p-2"
                value={status} onChange={e=>setStatus(e.target.value as any)}>
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="archived">archived</option>
        </select>
      </div>
      <button disabled={loading}
              className="rounded-xl bg-sky-600 px-4 py-2 font-semibold hover:bg-sky-500 disabled:opacity-50">
        {loading ? "Menyimpan…" : "Simpan"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </form>
  );
}
