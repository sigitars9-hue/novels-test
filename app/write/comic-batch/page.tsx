"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BottomBar from "@/components/BottomBar";
import {
  Loader2,
  Info,
  CheckCircle2,
  AlertTriangle,
  Images,
  Hash,
  BookOpen,
  Play,
} from "lucide-react";

type Msg = { type: "success" | "error" | "info"; text: string };

function slugify(x: string) {
  return x
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function ComicBatchPage() {
  const router = useRouter();
  const search = useSearchParams();

  const [userEmail, setUserEmail] = useState<string | null>(null);

  // form
  const [comicTitle, setComicTitle] = useState("");
  const [comicSlug, setComicSlug] = useState(""); // opsional: pakai slug existing, kalau kosong akan dibuat dari title
  const [chapterNumber, setChapterNumber] = useState<number | "">("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [imageLinks, setImageLinks] = useState(""); // satu URL per baris

  // ui
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [resultHref, setResultHref] = useState<string | null>(null);
  const [autoGo, setAutoGo] = useState(true); // otomatis buka reader setelah sukses

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  // Prefill slug dari query ?slug=
  useEffect(() => {
    const s = search.get("slug");
    if (s) setComicSlug(s);
  }, [search]);

  const lines = useMemo(
    () =>
      imageLinks
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [imageLinks]
  );

  const validUrls = useMemo(() => lines.filter((s) => /^https?:\/\//i.test(s)), [lines]);
  const invalidCount = lines.length - validUrls.length;

  async function handleSubmit() {
    setMsg(null);
    setResultHref(null); // reset link hasil

    // basic validation
    if (!comicTitle.trim() && !comicSlug.trim()) {
      setMsg({ type: "error", text: "Isi judul komik atau slug komik." });
      return;
    }
    if (chapterNumber === "" || !Number.isFinite(Number(chapterNumber))) {
      setMsg({ type: "error", text: "Nomor chapter tidak valid." });
      return;
    }
    if (!validUrls.length) {
      setMsg({
        type: "error",
        text: "Masukkan minimal satu URL gambar (http/https), satu per baris.",
      });
      return;
    }

    setSubmitting(true);
    try {
      // pastikan profile (sesuai pola kode kamu)
      const { error: rpcErr } = await supabase.rpc("ensure_profile");
      if (rpcErr) throw new Error(rpcErr.message || "Gagal memastikan profil.");

      // 1) cari/buat COMIC
      let finalSlug = comicSlug.trim();
      if (!finalSlug && comicTitle.trim()) finalSlug = slugify(comicTitle);
      if (!finalSlug) throw new Error("Slug komik kosong.");

      // cek apakah komik sudah ada
      const { data: existComic, error: exErr } = await supabase
        .from("comics")
        .select("id, slug, title")
        .eq("slug", finalSlug)
        .limit(1)
        .maybeSingle();
      if (exErr) throw new Error(exErr.message);

      let comicId: string | null = existComic?.id ?? null;

      if (!comicId) {
        // buat komik baru (judul minimal)
        const { data: newComic, error: addErr } = await supabase
          .from("comics")
          .insert([{ title: comicTitle.trim() || finalSlug, slug: finalSlug }])
          .select("id, slug")
          .single();
        if (addErr) throw new Error(addErr.message);
        comicId = newComic.id;
      }
      if (!comicId) throw new Error("Gagal mendapatkan ID komik.");

      // 2) buat CHAPTER (pastikan unik per (comic_id, number))
      const chNum = Number(chapterNumber);

      // cek dulu apakah chapter sudah ada
      const { data: existCh } = await supabase
        .from("chapters")
        .select("id")
        .eq("comic_id", comicId)
        .eq("number", chNum)
        .limit(1)
        .maybeSingle();

      let chapterId: string | null = existCh?.id ?? null;

      if (!chapterId) {
        const { data: ch, error: chErr } = await supabase
          .from("chapters")
          .insert([{ comic_id: comicId, number: chNum, title: chapterTitle || null }])
          .select("id")
          .single();
        if (chErr) throw new Error(chErr.message);
        chapterId = ch.id;
      } else {
        // jika chapter sudah ada, kosongkan gambar lama lalu ganti (kalau mau append, hapus blok ini)
        await supabase.from("chapter_images").delete().eq("chapter_id", chapterId);
      }
      if (!chapterId) throw new Error("Gagal mendapatkan ID chapter.");

      // 3) masukkan gambar-gambar (urut sesuai baris sebagai page 1..n)
      const rows = validUrls.map((url, idx) => ({
        chapter_id: chapterId!,
        page: idx + 1,
        url,
      }));

      const { error: imgErr } = await supabase.from("chapter_images").insert(rows);
      if (imgErr) throw new Error(imgErr.message);

      const href = `/read/${finalSlug}/${chNum}`;
      setResultHref(href);
      setMsg({
        type: "success",
        text: `Chapter ${chNum} berhasil diposting dengan ${rows.length} halaman.`,
      });

      if (autoGo) {
        // beri jeda singkat agar toast tampil lalu push
        setTimeout(() => router.push(href), 250);
      }
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Gagal memposting komik." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* HERO */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_20%_-10%,rgba(192,132,252,.12),transparent),radial-gradient(700px_320px_at_80%_0%,rgba(244,114,182,.12),transparent)]" />
        <div className="mx-auto w-[min(980px,95vw)] px-4 py-8">
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Images className="h-7 w-7 text-fuchsia-300" />
            Posting Komik (Batch Link)
          </h1>
          <p className="mt-1 text-sm text-zinc-300/90">
            Masukkan URL gambar per baris (diurutkan jadi page 1..N).{" "}
            {userEmail ? `Masuk sebagai ${userEmail}.` : ""}
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/write"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            >
              &larr; Kembali ke Write
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            >
              Home
            </Link>
          </div>
        </div>
      </section>

      {/* BODY */}
      <main className="mx-auto w-[min(980px,95vw)] px-4 pb-10">
        <div className="mb-4 rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-fuchsia-300" />
              <span>
                Jika <code>slug</code> komik diisi dan sudah ada, sistem akan menggunakan komik itu.
                Jika kosong, sistem akan membuat komik baru dari judul.
              </span>
            </div>

            {/* Auto redirect toggle */}
            <label className="inline-flex select-none items-center gap-2 text-xs text-zinc-300/90">
              <input
                type="checkbox"
                checked={autoGo}
                onChange={(e) => setAutoGo(e.target.checked)}
              />
              Auto buka halaman baca setelah sukses
            </label>
          </div>
        </div>

        {msg && (
          <div
            className={[
              "mb-4 rounded-xl border p-3 text-sm",
              msg.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : msg.type === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-white/10 bg-zinc-900/60",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-center gap-2">
              {msg.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : msg.type === "error" ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Info className="h-4 w-4" />
              )}
              <span>{msg.text}</span>
            </div>

            {msg.type === "success" && resultHref && (
              <div className="mt-3">
                <Link
                  href={resultHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-fuchsia-700"
                >
                  <Play className="h-4 w-4" />
                  Lihat hasil di reader
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-5">
          {/* Judul / Slug */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm opacity-80">
                Judul Komik (jika membuat baru)
              </label>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 opacity-70" />
                <input
                  value={comicTitle}
                  onChange={(e) => setComicTitle(e.target.value)}
                  placeholder="Judul komik"
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 outline-none ring-1 ring-transparent transition focus:ring-fuchsia-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm opacity-80">Slug Komik (opsional)</label>
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 opacity-70" />
                <input
                  value={comicSlug}
                  onChange={(e) => setComicSlug(e.target.value)}
                  placeholder="contoh: one-piece"
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 outline-none ring-1 ring-transparent transition focus:ring-fuchsia-500"
                />
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                Jika kosong, slug akan dibuat otomatis dari judul.
              </div>
            </div>
          </div>

          {/* Chapter */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm opacity-80">Nomor Chapter</label>
              <input
                value={chapterNumber}
                onChange={(e) => setChapterNumber(e.target.value ? Number(e.target.value) : "")}
                type="number"
                min={1}
                placeholder="1"
                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 outline-none ring-1 ring-transparent transition focus:ring-fuchsia-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm opacity-80">Judul Chapter (opsional)</label>
              <input
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder="judul bab (opsional)"
                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 outline-none ring-1 ring-transparent transition focus:ring-fuchsia-500"
              />
            </div>
          </div>

          {/* Links */}
          <div>
            <label className="mb-1 block text-sm opacity-80">
              Link Gambar (satu URL per baris, urutan = page 1..N)
            </label>
            <textarea
              value={imageLinks}
              onChange={(e) => setImageLinks(e.target.value)}
              rows={10}
              placeholder={`https://cdn.example.com/komik/ch1/001.jpg
https://cdn.example.com/komik/ch1/002.jpg
https://cdn.example.com/komik/ch1/003.jpg`}
              className="w-full resize-y rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 outline-none ring-1 ring-transparent transition focus:ring-fuchsia-500"
            />
            <div className="mt-1 text-xs text-zinc-400">
              Terbaca {lines.length} baris, valid URL {validUrls.length}
              {invalidCount > 0 ? ` (invalid ${invalidCount})` : ""}.
            </div>
          </div>

          {/* PREVIEW */}
          {validUrls.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-3">
              <div className="mb-3 flex items-baseline justify-between">
                <div className="text-sm font-semibold">
                  Pratinjau ({Math.min(validUrls.length, 24)} dari {validUrls.length})
                </div>
                <div className="text-xs text-zinc-400">
                  Urutan sesuai baris: halaman #1, #2, dst.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {validUrls.slice(0, 24).map((u, i) => (
                  <figure key={`${u}-${i}`} className="relative overflow-hidden rounded-lg border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={u}
                      alt={`Page ${i + 1}`}
                      className="h-48 w-full object-cover"
                      loading="lazy"
                    />
                    <figcaption className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs">
                      #{i + 1}
                    </figcaption>
                  </figure>
                ))}
              </div>
              {validUrls.length > 24 && (
                <div className="mt-2 text-xs text-zinc-400">
                  Menampilkan 24 pratinjau pertama.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-2">
          <Link
            href="/write"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Batal
          </Link>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Mengunggah…
              </>
            ) : (
              <>Posting Komik</>
            )}
          </button>
        </div>
      </main>

      <BottomBar />
    </div>
  );
}
