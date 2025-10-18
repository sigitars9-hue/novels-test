"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ───────── helpers ───────── */
function extractImageUrls(input: string): string[] {
  // Ambil semua http/https yang ujungnya gambar umum
  const re = /(https?:\/\/[^\s"'<>()]+?\.(?:jpg|jpeg|png|webp|gif|avif|bmp))/gi;
  const matches = input.match(re) ?? [];
  // bersihin trailing tanda baca
  const cleaned = matches.map(u => u.replace(/[)",'>\]]+$/g, ""));
  return Array.from(new Set(cleaned));
}

function genToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

/* ───────── UI ───────── */
type Comic = { id: string; title: string };

export default function CreateChapterWithImages() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [comicId, setComicId] = useState("");
  const [number, setNumber] = useState<number>(1);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">("private");
  const [publishNow, setPublishNow] = useState(false);
  const [unlistedToken, setUnlistedToken] = useState("");
  const [urlsRaw, setUrlsRaw] = useState("");
  const detected = useMemo(() => extractImageUrls(urlsRaw), [urlsRaw]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // load komik untuk admin/owner (butuh policy SELECT yg sudah kita set)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("comics")
        .select("id,title")
        .order("title", { ascending: true });
      if (!error && data) setComics(data);
    })();
  }, []);

  // auto generate token saat pilih "unlisted"
  useEffect(() => {
    if (visibility === "unlisted" && !unlistedToken) setUnlistedToken(genToken());
  }, [visibility, unlistedToken]);

  const canSubmit = !!comicId && title.trim().length > 0 && number > 0 && detected.length > 0 && !loading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setMsg(null);

    let newChapterId: string | null = null;

    try {
      // 1) Ambil user untuk created_by
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User tidak ditemukan (belum login).");

      // 2) Buat CHAPTER
      const { data: chIns, error: chErr } = await supabase
        .from("chapters")
        .insert({
          comic_id: comicId,
          number,
          title,
          visibility,
          is_published: publishNow,
          published_at: publishNow ? new Date().toISOString() : null,
          unlisted_token: visibility === "unlisted" ? unlistedToken : null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (chErr) throw chErr;

      newChapterId = chIns.id as string;

      // 3) Siapkan rows images
      // cari ord terakhir
      const { data: exist, error: ordErr } = await supabase
        .from("images")
        .select("ord")
        .eq("chapter_id", newChapterId)
        .order("ord", { ascending: false })
        .limit(1);
      if (ordErr) throw ordErr;

      let start = exist?.[0]?.ord ?? 0;
      const rows = detected.map((url, i) => ({
        chapter_id: newChapterId!,
        url,
        ord: start + i + 1,
      }));

      // 4) Insert batch images
      const { error: imgErr } = await supabase.from("images").insert(rows);
      if (imgErr) throw imgErr;

      // 5) Sukses
      setMsg(`✅ Chapter & ${rows.length} gambar berhasil ditambahkan.`);
      setTitle("");
      setNumber(1);
      setPublishNow(false);
      setUrlsRaw("");
      if (visibility === "unlisted") {
        setMsg(prev => (prev ? prev + ` Link unlisted: /read/${newChapterId}?token=${unlistedToken}` : `Link unlisted: /read/${newChapterId}?token=${unlistedToken}`));
      }
    } catch (err: any) {
      // Rollback manual kalau images gagal setelah chapter dibuat
      if (newChapterId) {
        await supabase.from("chapters").delete().eq("id", newChapterId);
      }
      setMsg("❌ Gagal: " + (err?.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-white/10 p-4">
      <h3 className="text-lg font-semibold">Buat Chapter + Tambah Gambar (Satu Langkah)</h3>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm opacity-80">Komik</label>
          <select
            className="w-full rounded bg-zinc-900/60 p-2"
            value={comicId}
            onChange={(e) => setComicId(e.target.value)}
          >
            <option value="">— Pilih Komik —</option>
            {comics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <label className="text-sm opacity-80">Nomor Chapter</label>
          <input
            type="number"
            min={1}
            className="w-full rounded bg-zinc-900/60 p-2"
            value={number}
            onChange={(e) => setNumber(Number(e.target.value))}
          />

          <label className="text-sm opacity-80">Judul Chapter</label>
          <input
            className="w-full rounded bg-zinc-900/60 p-2"
            placeholder="Judul…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="flex items-center gap-3">
            <div>
              <label className="text-sm opacity-80">Visibility</label>
              <select
                className="ml-2 rounded bg-zinc-900/60 p-2"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as any)}
              >
                <option value="private">private</option>
                <option value="unlisted">unlisted</option>
                <option value="public">public</option>
              </select>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={publishNow}
                onChange={(e) => setPublishNow(e.target.checked)}
              />
              <span>Publish sekarang</span>
            </label>
          </div>

          {visibility === "unlisted" && (
            <div>
              <label className="text-sm opacity-80">Unlisted token</label>
              <input
                className="w-full rounded bg-zinc-900/60 p-2"
                value={unlistedToken}
                onChange={(e) => setUnlistedToken(e.target.value)}
              />
              <p className="text-xs opacity-70">
                Link akan seperti: <code>/read/&lt;chapterId&gt;?token={unlistedToken}</code>
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm opacity-80">Tempel URL Gambar (boleh HTML/JSON/baris biasa)</label>
          <textarea
            className="h-40 w-full rounded bg-zinc-900/60 p-2"
            placeholder="https://cdn.example.com/p1.jpg
https://cdn.example.com/p2.png
<img src='https://blogger.googleusercontent.com/.../img_01.jpg'>"
            value={urlsRaw}
            onChange={(e) => setUrlsRaw(e.target.value)}
          />
          <div className="text-xs opacity-70">
            URL gambar terdeteksi: <b>{detected.length}</b>
          </div>
        </div>
      </div>

      <button
        disabled={!canSubmit}
        className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading ? "Menyimpan…" : "Buat chapter & tambah gambar"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </form>
  );
}
