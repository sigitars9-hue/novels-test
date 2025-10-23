"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

/** Ambil SEMUA URL http/https dari teks, rapikan trailing , " ' ) ]  */
function extractUrls(raw: string): string[] {
  const m = raw.match(/https?:\/\/[^\s"'>)\],]+/gi) || [];
  const cleaned = m.map((u) => u.replace(/[,"'\s)\]]+$/g, ""));
  // unik, pertahankan urutan
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const u of cleaned) {
    if (!seen.has(u)) {
      seen.add(u);
      uniq.push(u);
    }
  }
  return uniq;
}

export default function ComicBatchPage() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState<string | null>(null);

  // form
  const [comicTitle, setComicTitle] = useState("");
  const [comicSlug, setComicSlug] = useState(""); // opsional
  const [chapterNumber, setChapterNumber] = useState<number | "">("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [imageLinks, setImageLinks] = useState("");

  // ui
  const [previewOn, setPreviewOn] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [resultHref, setResultHref] = useState<string | null>(null);
  const [autoGo, setAutoGo] = useState(true);

  // login info
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  // Prefill ?slug= tanpa useSearchParams/Suspense
  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = new URLSearchParams(window.location.search).get("slug");
    if (s) setComicSlug(s);
  }, []);

  // Parser link yang toleran
  const urls = useMemo(() => extractUrls(imageLinks), [imageLinks]);
  const linesCount = useMemo(
    () => imageLinks ? imageLinks.split("\n").filter((s) => s.trim().length).length : 0,
    [imageLinks]
  );

  async function handleSubmit() {
    setMsg(null);
    setResultHref(null);

    // validasi ringan
    if (!comicTitle.trim() && !comicSlug.trim()) {
      setMsg({ type: "error", text: "Isi judul komik atau slug komik." });
      return;
    }
    if (chapterNumber === "" || !Number.isFinite(Number(chapterNumber))) {
      setMsg({ type: "error", text: "Nomor chapter tidak valid." });
      return;
    }
    if (!urls.length) {
      setMsg({
        type: "error",
        text: "Masukkan minimal satu URL gambar (http/https).",
      });
      return;
    }

    setSubmitting(true);
    try {
      // pastikan profile
      const { error: rpcErr } = await supabase.rpc("ensure_profile");
      if (rpcErr) throw new Error(rpcErr.message || "Gagal memastikan profil.");

      // 1) COMIC
      let finalSlug = comicSlug.trim();
      if (!finalSlug && comicTitle.trim()) finalSlug = slugify(comicTitle);
      if (!finalSlug) throw new Error("Slug komik kosong.");

      const { data: existComic, error: exErr } = await supabase
        .from("comics")
        .select("id, slug, title")
        .eq("slug", finalSlug)
        .limit(1)
        .maybeSingle();
      if (exErr) throw new Error(exErr.message);

      let comicId: string | null = existComic?.id ?? null;

      if (!comicId) {
        const { data: newComic, error: addErr } = await supabase
          .from("comics")
          .insert([{ title: comicTitle.trim() || finalSlug, slug: finalSlug }])
          .select("id, slug")
          .single();
        if (addErr) throw new Error(addErr.message);
        comicId = newComic.id;
      }
      if (!comicId) throw new Error("Gagal mendapatkan ID komik.");

      // 2) CHAPTER
      const chNum = Number(chapterNumber);
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
        // replace gambar jika sudah ada
        await supabase.from("chapter_images").delete().eq("chapter_id", chapterId);
      }
      if (!chapterId) throw new Error("Gagal mendapatkan ID chapter.");

      // 3) IMAGES
      const rows = urls.map((url, idx) => ({
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

      if (autoGo) setTimeout(() => router.push(href), 300);
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
          <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
            <Images className="h-7 w-7 text-fuchsia-300" />
            Posting Komik (Batch Link)
          </h1>
          <p className="mt-1 text-sm text-zinc-300/90">
            Masukkan URL gambar per baris (urut otomatis jadi page 1..N).{" "}
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
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-fuchsia-300" />
            <span>
              Isi <code>slug</code> jika ingin pakai komik yang sudah ada. Jika kosong,
              komik baru akan dibuat dari judul.
            </span>
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
            <div className="flex items-center gap-2">
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
              <div className="mt-3 flex items-center gap-3">
                <Link
                  href={resultHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-fuchsia-700"
                >
                  <Play className="h-4 w-4" />
                  Lihat hasil di reader
                </Link>

                <label className="inline-flex cursor-pointer items-center gap-2 text-xs opacity-80">
                  <input
                    type="checkbox"
                    checked={autoGo}
                    onChange={(e) => setAutoGo(e.target.checked)}
                  />
                  Auto-redirect setelah posting
                </label>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-6">
          {/* Judul / Slug */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm opacity-80">Judul Komik (jika membuat baru)</label>
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

          {/* Links + PREVIEW */}
          <div className="grid gap-4 lg:grid-cols-[1fr,380px]">
            <div>
              <label className="mb-1 block text-sm opacity-80">
                Link Gambar (satu URL per baris atau array/JSON, urutan = page 1..N)
              </label>
              <textarea
                value={imageLinks}
                onChange={(e) => setImageLinks(e.target.value)}
                rows={12}
                placeholder={`https://cdn.example.com/komik/ch1/001.jpg
"https://cdn.example.com/komik/ch1/002.jpg",
"https://cdn.example.com/komik/ch1/003.jpg"`}
                className="w-full resize-y rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 outline-none ring-1 ring-transparent transition focus:ring-fuchsia-500"
              />
              <div className="mt-1 text-xs text-zinc-400">
                Baris: {linesCount} · URL valid terdeteksi: {urls.length}
              </div>
            </div>

            {/* Panel preview dengan switch */}
            <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold opacity-90">Pratinjau</div>

                {/* Switch ala novel */}
                <button
                  onClick={() => setPreviewOn((v) => !v)}
                  className={
                    previewOn
                      ? "relative h-7 w-12 rounded-full bg-fuchsia-600 transition-colors"
                      : "relative h-7 w-12 rounded-full bg-zinc-600/60 transition-colors"
                  }
                  aria-label="Toggle Preview"
                >
                  <span
                    className={
                      previewOn
                        ? "absolute left-[calc(100%-1.65rem)] top-0.5 inline-block h-6 w-6 rounded-full bg-white shadow"
                        : "absolute left-0.5 top-0.5 inline-block h-6 w-6 rounded-full bg-white shadow"
                    }
                  />
                </button>
              </div>

              {!previewOn ? (
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs opacity-70">
                  Pratinjau dimatikan.
                </div>
              ) : urls.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs opacity-70">
                  Belum ada URL valid.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {urls.slice(0, 20).map((u, i) => (
                    <figure key={u + i} className="overflow-hidden rounded-lg border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u}
                        alt={`p${i + 1}`}
                        className="h-24 w-full object-cover"
                        loading="lazy"
                      />
                      <figcaption className="px-2 py-1 text-center text-[10px] opacity-70">
                        p{i + 1}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}

              {previewOn && urls.length > 20 && (
                <div className="mt-2 text-center text-[11px] opacity-70">
                  +{urls.length - 20} lagi…
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <label className="mr-auto inline-flex cursor-pointer items-center gap-2 text-xs opacity-80">
            <input
              type="checkbox"
              checked={autoGo}
              onChange={(e) => setAutoGo(e.target.checked)}
            />
            Auto-redirect ke reader setelah sukses
          </label>

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
