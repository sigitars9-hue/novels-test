"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Comic = { id: string; title: string; slug?: string };

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function extractImageUrls(input: string): string[] {
  // Ambil semua http/https yang ujungnya format gambar umum
  const re =
    /(https?:\/\/[^\s"'<>()]+?\.(?:jpg|jpeg|png|webp|gif|avif|bmp))/gi;
  const matches = input.match(re) ?? [];
  const cleaned = matches.map((u) => u.replace(/[)",'>\]]+$/g, ""));
  return Array.from(new Set(cleaned));
}

function genToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

export default function AdminComicsPage() {
  // ————— STATE
  const [comics, setComics] = useState<Comic[]>([]);
  const [comicId, setComicId] = useState("");
  const [showNewComic, setShowNewComic] = useState(false);
  const [newComicTitle, setNewComicTitle] = useState("");
  const [newComicSlug, setNewComicSlug] = useState("");
  const [newComicDesc, setNewComicDesc] = useState("");
  const [newComicCover, setNewComicCover] = useState("");
  const [status] = useState<"draft" | "published" | "archived">("draft");

  const [chNumber, setChNumber] = useState<number>(1);
  const [chTitle, setChTitle] = useState("");
  const [visibility, setVisibility] =
    useState<"private" | "unlisted" | "public">("private");
  const [publishNow, setPublishNow] = useState(false);
  const [unlistedToken, setUnlistedToken] = useState("");

  const [urlsRaw, setUrlsRaw] = useState("");
  const detected = useMemo(() => extractImageUrls(urlsRaw), [urlsRaw]);

  // preview controls
  const [showAllPreview, setShowAllPreview] = useState(false);
  const previewList = useMemo(
    () => (showAllPreview ? detected : detected.slice(0, 12)),
    [detected, showAllPreview]
  );

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // link setelah sukses
  const [lastChapterId, setLastChapterId] = useState<string | null>(null);
  const [lastUnlistedToken, setLastUnlistedToken] = useState<string | null>(
    null
  );

  const selectedComic = useMemo(
    () => comics.find((c) => c.id === comicId),
    [comics, comicId]
  );

  // ————— LOAD KOMIK
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("comics")
        .select("id,title,slug")
        .order("title", { ascending: true });
      if (!error && data) setComics(data);
    })();
  }, []);

  // Auto token kalau unlisted
  useEffect(() => {
    if (visibility === "unlisted" && !unlistedToken) setUnlistedToken(genToken());
  }, [visibility, unlistedToken]);

  // Saat pilih komik, auto-sarankan next chapter number
  useEffect(() => {
    (async () => {
      if (!comicId) return;
      const { data, error } = await supabase
        .from("chapters")
        .select("number")
        .eq("comic_id", comicId)
        .order("number", { ascending: false })
        .limit(1);
      if (!error) {
        const max = data?.[0]?.number ?? 0;
        setChNumber(max + 1);
      }
    })();
  }, [comicId]);

  const canSubmit =
    !!comicId &&
    chTitle.trim().length > 0 &&
    chNumber > 0 &&
    detected.length > 0 &&
    !loading;

  // ————— ACTION: BUAT KOMIK INLINE
  async function createComicInline() {
    setLoading(true);
    setMsg(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Harus login.");

      const slug = newComicSlug || slugify(newComicTitle);
      const { data, error } = await supabase
        .from("comics")
        .insert({
          slug,
          title: newComicTitle.trim(),
          description: newComicDesc || null,
          cover_url: newComicCover || null,
          status,
          author_id: user.id,
        })
        .select("id,title,slug")
        .single();
      if (error) throw error;

      setComics((prev) => [...prev, data]);
      setComicId(data.id);
      setShowNewComic(false);
      setNewComicTitle("");
      setNewComicSlug("");
      setNewComicDesc("");
      setNewComicCover("");
      setMsg("✅ Komik dibuat. Lanjut isi chapter.");
    } catch (e: any) {
      setMsg("❌ Gagal buat komik: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  // ————— ACTION: BUAT CHAPTER + IMAGES (one-click)
  async function handleCreateAll(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setMsg(null);

    let newChapterId: string | null = null;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Harus login.");

      // 1) Hindari duplikat nomor
      const { data: taken } = await supabase
        .from("chapters")
        .select("number")
        .eq("comic_id", comicId);
      const used = new Set((taken ?? []).map((t: any) => Number(t.number)));
      let number = chNumber;
      while (used.has(number)) number++;

      // 2) Insert chapter
      const { data: ch, error: chErr } = await supabase
        .from("chapters")
        .insert({
          comic_id: comicId,
          number,
          title: chTitle.trim(),
          visibility,
          is_published: publishNow,
          published_at: publishNow ? new Date().toISOString() : null,
          unlisted_token: visibility === "unlisted" ? unlistedToken : null,
          created_by: user.id,
        })
        .select("id, number")
        .single();
      if (chErr) throw chErr;

      newChapterId = ch.id as string;
      setLastChapterId(newChapterId);
      setLastUnlistedToken(visibility === "unlisted" ? unlistedToken : null);

      if (number !== chNumber) {
        setMsg(`ℹ️ Nomor ${chNumber} sudah dipakai. Dipindah ke nomor ${number}.`);
      }

      // 3) Insert batch images
      const rows = detected.map((url, i) => ({
        chapter_id: newChapterId!,
        url,
        ord: i + 1,
      }));
      const { error: imgErr } = await supabase.from("images").insert(rows);
      if (imgErr) throw imgErr;

      // 4) Beres
      let success = `✅ Chapter #${number} dibuat & ${rows.length} gambar ditambahkan.`;
      if (visibility === "unlisted") {
        success += ` Link unlisted aktif.`;
      }
      setMsg(success);

      // reset minimal
      setChTitle("");
      setUrlsRaw("");
      setPublishNow(false);
      setChNumber(number + 1);
    } catch (e: any) {
      if (newChapterId) await supabase.from("chapters").delete().eq("id", newChapterId);
      setMsg("❌ Gagal: " + e.message);
      setLastChapterId(null);
      setLastUnlistedToken(null);
    } finally {
      setLoading(false);
    }
  }

  // ————— UI
  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-2xl font-bold">Dashboard Komik (Admin)</h1>

      <form onSubmit={handleCreateAll} className="space-y-6 rounded-2xl border border-white/10 p-5">
        {/* 1) PILIH / BUAT KOMIK */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Komik</label>
            <button
              type="button"
              className="text-xs underline opacity-80 hover:opacity-100"
              onClick={() => setShowNewComic((v) => !v)}
            >
              {showNewComic ? "Tutup form komik baru" : "Buat komik baru"}
            </button>
          </div>

          {!showNewComic ? (
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
          ) : (
            <div className="rounded-xl bg-zinc-900/40 p-3">
              <input
                className="mb-2 w-full rounded bg-zinc-900/60 p-2"
                placeholder="Judul komik"
                value={newComicTitle}
                onChange={(e) => setNewComicTitle(e.target.value)}
              />
              <input
                className="mb-2 w-full rounded bg-zinc-900/60 p-2"
                placeholder="Slug (opsional)"
                value={newComicSlug}
                onChange={(e) => setNewComicSlug(e.target.value)}
              />
              <textarea
                className="mb-2 w-full rounded bg-zinc-900/60 p-2"
                placeholder="Deskripsi (opsional)"
                value={newComicDesc}
                onChange={(e) => setNewComicDesc(e.target.value)}
              />
              <input
                className="mb-3 w-full rounded bg-zinc-900/60 p-2"
                placeholder="Cover URL (opsional)"
                value={newComicCover}
                onChange={(e) => setNewComicCover(e.target.value)}
              />
              <button
                type="button"
                onClick={createComicInline}
                disabled={loading || !newComicTitle.trim()}
                className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold hover:bg-sky-500 disabled:opacity-50"
              >
                {loading ? "Menyimpan…" : "Simpan komik & pilih"}
              </button>
            </div>
          )}
        </div>

        {/* 2) DETAIL CHAPTER + URL GAMBAR */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Nomor Chapter</label>
            <input
              type="number"
              min={1}
              className="w-full rounded bg-zinc-900/60 p-2"
              value={chNumber}
              onChange={(e) => setChNumber(Number(e.target.value))}
            />

            <label className="text-sm font-semibold">Judul Chapter</label>
            <input
              className="w-full rounded bg-zinc-900/60 p-2"
              placeholder="Judul…"
              value={chTitle}
              onChange={(e) => setChTitle(e.target.value)}
            />

            <div className="flex items-center gap-3">
              <div>
                <label className="text-sm">Visibility</label>
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
                <label className="text-sm">Unlisted token</label>
                <input
                  className="w-full rounded bg-zinc-900/60 p-2"
                  value={unlistedToken}
                  onChange={(e) => setUnlistedToken(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">
              Tempel URL Gambar (boleh HTML/JSON/baris biasa)
            </label>
            <textarea
              className="h-40 w-full rounded bg-zinc-900/60 p-2"
              placeholder={`https://cdn.example/p1.jpg
https://cdn.example/p2.png
<img src="https://blogger.googleusercontent.com/.../img01.jpg">`}
              value={urlsRaw}
              onChange={(e) => setUrlsRaw(e.target.value)}
            />
            <div className="text-xs opacity-70">
              URL gambar terdeteksi: <b>{detected.length}</b>
            </div>

            {/* Preview grid */}
            {detected.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Preview</span>
                  {detected.length > 12 && (
                    <button
                      type="button"
                      className="text-xs underline opacity-80 hover:opacity-100"
                      onClick={() => setShowAllPreview((v) => !v)}
                    >
                      {showAllPreview ? "Sembunyikan" : `Tampilkan semua (${detected.length})`}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {previewList.map((u) => (
                    <div key={u} className="overflow-hidden rounded-lg bg-zinc-900/50">
                      {/* biar cepat, biarkan img langsung load URL */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u}
                        alt=""
                        loading="lazy"
                        className="h-24 w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3) SUBMIT & LINK HASIL */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={!canSubmit}
            className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "Menyimpan…" : "Buat Chapter + Tambah Gambar"}
          </button>

          {/* Tombol navigasi setelah sukses */}
          {lastChapterId && (
            <>
              <Link
                className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold hover:bg-indigo-500"
                href={
                  `/read/${lastChapterId}` +
                  (lastUnlistedToken ? `?token=${lastUnlistedToken}` : "")
                }
                target="_blank"
              >
                Lihat Chapter
              </Link>

              <Link
                className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold hover:bg-sky-500"
                href={
                  selectedComic?.slug
                    ? `/comics/${selectedComic.slug}`
                    : `/comics/${comicId}`
                }
                target="_blank"
              >
                Lihat Komik
              </Link>
            </>
          )}

          {msg && <span className="text-sm">{msg}</span>}
        </div>
      </form>
    </div>
  );
}
