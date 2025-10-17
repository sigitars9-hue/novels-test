"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import clsx from "clsx";

type Novel = { id: string; title: string; slug: string | null };
type Chapter = { id: string; number: number; title: string | null };

export default function UploadComicPage() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [novelId, setNovelId] = useState<string>("");
  const [chapterNumber, setChapterNumber] = useState<number>(1);
  const [chapterTitle, setChapterTitle] = useState<string>("");
  const [urlsRaw, setUrlsRaw] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<{ id: string; role?: string } | null>(null);

  // cek user + role (kalau kamu simpan role di profiles.role)
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) { setMe(null); return; }
      const { data: p } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", uid)
        .maybeSingle();
      setMe({ id: uid, role: p?.role ?? undefined });
    })();
  }, []);

  // ambil daftar novel (sementara ambil semua; tahap 2 kita filter kind=komik)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("novels")
        .select("id, title, slug")
        .order("created_at", { ascending: false });
      if (!error) setNovels(data || []);
    })();
  }, []);

  const urlList = useMemo(
    () =>
      urlsRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [urlsRaw]
  );

  async function handleSave() {
    if (!novelId) return alert("Pilih judul (series) dulu.");
    if (!chapterNumber || chapterNumber < 1)
      return alert("Isi nomor chapter dengan benar.");
    if (urlList.length === 0)
      return alert("Tempelkan minimal 1 URL halaman.");

    setLoading(true);
    try {
      // 1) upsert chapter by (novel_id, number)
      const { data: ch, error: e1 } = await supabase
        .from("chapters")
        .upsert(
          [
            {
              novel_id: novelId,     // kolom di tabel kamu: "novel_id" (bukan content_id)
              number: chapterNumber,
              title: chapterTitle || null,
            },
          ],
          { onConflict: "novel_id,number" }
        )
        .select("id")
        .single();
      if (e1) throw e1;

      // 2) hapus halaman lama (jika ada), lalu insert baru
      await supabase.from("chapter_pages").delete().eq("chapter_id", ch.id);

      const rows = urlList.map((u, i) => ({
        chapter_id: ch.id,
        idx: i + 1,
        source_url: u,
      }));
      const { error: e2 } = await supabase.from("chapter_pages").insert(rows);
      if (e2) throw e2;

      alert("Chapter tersimpan!");
      setUrlsRaw("");
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "Gagal menyimpan chapter.");
    } finally {
      setLoading(false);
    }
  }

  // Batasi akses admin (sederhana)
  if (!me) {
    return (
      <div className="p-6 text-zinc-200">
        <h1 className="text-xl font-bold">Upload Komik</h1>
        <p className="mt-2 text-zinc-400">Silakan login…</p>
      </div>
    );
  }
  if (me.role !== "admin") {
    return (
      <div className="p-6 text-zinc-200">
        <h1 className="text-xl font-bold">Upload Komik</h1>
        <p className="mt-2 text-rose-300">Akses ditolak (bukan admin).</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-24">
      <div className="mx-auto w-[min(900px,94vw)] px-4 py-6">
        <h1 className="text-2xl font-extrabold">Upload Chapter Komik</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Paste daftar URL halaman (satu baris satu URL), klik Simpan. Chapter akan di-upsert.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm font-semibold">Series (Novel/Komik)</label>
            <select
              value={novelId}
              onChange={(e) => setNovelId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 outline-none"
            >
              <option value="">— pilih —</option>
              {novels.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold">No. Chapter</label>
                <input
                  type="number"
                  value={chapterNumber}
                  onChange={(e) => setChapterNumber(parseInt(e.target.value || "1"))}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 outline-none"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold">Judul (opsional)</label>
                <input
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 outline-none"
                  placeholder="contoh: 'Festival Musim Panas'"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold">
              URL Halaman (1 URL per baris)
            </label>
            <textarea
              value={urlsRaw}
              onChange={(e) => setUrlsRaw(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 font-mono text-sm outline-none"
              placeholder={`https://cdn.site.com/manga/xxx/001.jpg
https://cdn.site.com/manga/xxx/002.jpg
https://cdn.site.com/manga/xxx/003.jpg`}
            />
            <div className="text-xs text-zinc-400">
              Total halaman: <span className="font-semibold text-zinc-200">{urlList.length}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className={clsx(
              "rounded-xl px-4 py-2 font-semibold ring-1 ring-white/10",
              loading ? "bg-zinc-800 text-zinc-400" : "bg-violet-600 text-white hover:bg-violet-500"
            )}
          >
            {loading ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
