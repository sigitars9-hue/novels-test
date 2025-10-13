"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Novel, Chapter } from "@/lib/db";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import DOMPurify from "dompurify";

import {
  ArrowLeft,
  Home,
  Settings,
  Play,
  Pause,
  List,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  MessageSquare,
  Type,
} from "lucide-react";

import CommentsSection from "@/components/CommentsSection";

/* ───────── Utils ───────── */
const WPM = 220; // words per minute
function looksLikeHTML(s: string) {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}
function stripHtml(html: string) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}
function countWords(s: string) {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

type ReaderPageProps = {
  params: { slug: string; chapter: string };
};

export default function ReaderPage({ params }: ReaderPageProps) {
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // prev/next
  const [prevChapter, setPrevChapter] = useState<Chapter | null>(null);
  const [nextChapter, setNextChapter] = useState<Chapter | null>(null);

  // reader
  const [autoScroll, setAutoScroll] = useState(false);
  const [speed, setSpeed] = useState(60); // px/s
  const [showSettings, setShowSettings] = useState(false);

  // UI/Immersive
  const [immersive, setImmersive] = useState(true);
  const [showUI, setShowUI] = useState(true);

  // upgrades
  const [progress, setProgress] = useState(0);          // %
  const [fontScale, setFontScale] = useState(1);        // 1 = default
  const [bookmarked, setBookmarked] = useState(false);  // local flag
  const [estMin, setEstMin] = useState<number>(0);      // est reading minutes

  const contentRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);

  /* ───────── Fetch data ───────── */
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr(null);

    (async () => {
      try {
        const { data: n, error: e1 } = await supabase
          .from("novels")
          .select("*")
          .eq("slug", params.slug)
          .single();
        if (e1) throw e1;
        if (!mounted) return;
        setNovel(n || null);

        if (n) {
          const num = parseInt(params.chapter, 10);
          const { data: ch, error: e2 } = await supabase
            .from("chapters")
            .select("*")
            .eq("novel_id", (n as any).id)
            .eq("number", num)
            .maybeSingle();
          if (e2) throw e2;
          if (!mounted) return;
          setChapter((ch as Chapter) || null);

          if (ch?.id) {
            const [prevQ, nextQ] = await Promise.all([
              supabase
                .from("chapters")
                .select("*")
                .eq("novel_id", (n as any).id)
                .lt("number", num)
                .order("number", { ascending: false })
                .limit(1),
              supabase
                .from("chapters")
                .select("*")
                .eq("novel_id", (n as any).id)
                .gt("number", num)
                .order("number", { ascending: true })
                .limit(1),
            ]);
            setPrevChapter(prevQ.data?.[0] ?? null);
            setNextChapter(nextQ.data?.[0] ?? null);
          } else {
            setPrevChapter(null);
            setNextChapter(null);
          }
        } else {
          setChapter(null);
          setPrevChapter(null);
          setNextChapter(null);
        }
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? "Terjadi kesalahan saat memuat data.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [params.slug, params.chapter]);

  /* ───────── Content mode (HTML / MD / empty) ───────── */
  const contentMode: "html" | "md" | "empty" = useMemo(() => {
    const raw = chapter?.content?.toString() ?? "";
    if (!raw.trim()) return "empty";
    return looksLikeHTML(raw) ? "html" : "md";
  }, [chapter?.content]);

  const sanitizedHTML = useMemo(() => {
    if (contentMode !== "html") return "";
    const raw = chapter?.content?.toString() ?? "";
    return DOMPurify.sanitize(raw);
  }, [contentMode, chapter?.content]);

  // estimate reading time (recalc when chapter changes)
  useEffect(() => {
    const raw = chapter?.content?.toString() ?? "";
    let words = 0;
    if (looksLikeHTML(raw)) words = countWords(stripHtml(raw));
    else words = countWords(raw);
    setEstMin(Math.max(1, Math.round(words / WPM)));
  }, [chapter?.content]);

  /* ───────── Fullscreen helpers ───────── */
  const enterFullscreen = async () => {
    try {
      const el = document.documentElement as any;
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } catch {}
  };
  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {}
  };
  useEffect(() => { immersive ? enterFullscreen() : exitFullscreen(); }, [immersive]);

  /* ───────── Auto-scroll loop ───────── */
  useEffect(() => {
    if (!autoScroll) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const step = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const delta = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      window.scrollBy(0, speed * delta);

      const atBottom =
        window.innerHeight + window.scrollY >=
        (document.documentElement?.scrollHeight || 0) - 2;
      if (atBottom) {
        setAutoScroll(false);
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = 0;
    };
  }, [autoScroll, speed]);

  /* ───────── Shortcuts ───────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.getAttribute("contenteditable") === "true");
      if (isEditing) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (!showUI) return;
        setAutoScroll((v) => !v);
      } else if (e.key === "ArrowUp") {
        window.scrollBy({ top: -window.innerHeight * 0.9, behavior: "smooth" });
      } else if (e.key === "ArrowDown") {
        window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" });
      } else if (e.key === "Escape") {
        setImmersive(false);
        setShowUI(true);
        exitFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showUI]);

  /* ───────── Progress + font scale + bookmark ───────── */
  // track progress
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const pct =
        ((window.scrollY) / ((h.scrollHeight - h.clientHeight) || 1)) * 100;
      setProgress(Math.min(100, Math.max(0, pct)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // seek helper
  const seekTo = (pct: number) => {
    const h = document.documentElement;
    const target =
      ((h.scrollHeight - h.clientHeight) * Math.min(100, Math.max(0, pct))) / 100;
    window.scrollTo({ top: target, behavior: "smooth" });
  };

  // apply CSS var to article
  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current.style.setProperty("--reader-font-scale", String(fontScale));
  }, [fontScale]);

  // save & restore position (local)
  useEffect(() => {
    const key = `readpos:${params.slug}:${params.chapter}`;
    const id = setInterval(
      () => localStorage.setItem(key, String(progress.toFixed(1))),
      1500
    );
    return () => clearInterval(id);
  }, [progress, params.slug, params.chapter]);

  useEffect(() => {
    const key = `readpos:${params.slug}:${params.chapter}`;
    const saved = Number(localStorage.getItem(key) || "0");
    if (saved > 0) setTimeout(() => seekTo(saved), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug, params.chapter]);

  /* ───────── UI ───────── */
  const toggleUI = () => setShowUI((v) => !v);

  const title =
    novel && chapter ? `${novel.title} > Bab ${chapter.number}` : "Membaca…";

  const prevHref =
    prevChapter && novel ? `/read/${params.slug}/${(prevChapter as any).number}` : "#";
  const nextHref =
    nextChapter && novel ? `/read/${params.slug}/${(nextChapter as any).number}` : "#";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* TopBar hidden saat immersive */}
      {!immersive && (
        <div className="sticky top-0 z-50">
          <div className="border-b border-white/10 bg-zinc-950/90 px-4 py-3">
            <div className="mx-auto w-[min(980px,95vw)]">
              <Link href="/" className="text-sm opacity-80 hover:opacity-100">
                Home
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* BREADCRUMB FLOAT BAR */}
      <div
        className={`pointer-events-none fixed left-1/2 top-3 z-40 w-[min(980px,95vw)] -translate-x-1/2 transition-opacity ${
          showUI ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl bg-zinc-900/80 px-4 py-3 shadow-lg ring-1 ring-white/10 backdrop-blur">
          <Link
            href={`/novel/${params.slug}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700"
            aria-label="Kembali"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="flex-1 text-center">
            <div className="text-sm font-semibold text-zinc-200">
              {novel?.title ?? "…"}
              <span className="mx-2 opacity-50">{">"}</span>
              <span className="text-sky-400">
                {chapter ? `Bab ${chapter.number}` : "…"}
              </span>
            </div>
            {!!estMin && (
              <div className="mt-0.5 text-xs text-sky-300/80">
                ~{estMin} menit baca
              </div>
            )}
          </div>

          <Link
            href="/"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700"
            aria-label="Beranda"
          >
            <Home className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* CONTENT (klik untuk toggle UI) */}
      <main
        ref={contentRef}
        className="mx-auto w-[min(980px,95vw)] pt-20 pb-28"
        aria-label={title}
        onClick={toggleUI}
      >
        {loading && (
          <div className="mx-auto mt-10 w-fit rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm">
            Loading…
          </div>
        )}

        {!loading && err && (
          <div className="mx-auto mt-10 w-fit rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {err}
          </div>
        )}

        {!loading && !err && (!novel || !chapter) && (
          <div className="mx-auto mt-10 w-fit rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm">
            Bab tidak ditemukan.
          </div>
        )}

        {!loading && !err && novel && chapter && (
          <>
            {/* Top Prev/Next */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <Link
                href={prevHref}
                onClick={(e) => { if (!prevChapter) e.preventDefault(); }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                  prevChapter ? "bg-zinc-800 hover:bg-zinc-700" : "bg-zinc-800/40 cursor-not-allowed"
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
                Sebelumnya
              </Link>

              <div className="text-xs opacity-70">
                Bab {chapter.number} · {chapter.title || "Tanpa Judul"}
              </div>

              <Link
                href={nextHref}
                onClick={(e) => { if (!nextChapter) e.preventDefault(); }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                  nextChapter ? "bg-zinc-800 hover:bg-zinc-700" : "bg-zinc-800/40 cursor-not-allowed"
                }`}
              >
                Berikutnya
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <article className="prose prose-invert max-w-none [font-size:clamp(1rem,calc(1rem*var(--reader-font-scale,1)),1.5rem)]">
              <h1 className="mb-4">
                {novel.title} — Bab {chapter.number}: {chapter.title}
              </h1>

              {/* HTML / MD rendering */}
              {(() => {
                if (contentMode === "html")
                  return (
                    <div
                      className="prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
                    />
                  );
                if (contentMode === "md")
                  return (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      rehypePlugins={[rehypeRaw, rehypeSanitize]}
                    >
                      {chapter.content as unknown as string}
                    </ReactMarkdown>
                  );
                return <p className="opacity-70">Belum ada konten untuk bab ini.</p>;
              })()}
            </article>

            {/* Bottom Prev/Next */}
            <div className="mt-8 flex items-center justify-between gap-3">
              <Link
                href={prevHref}
                onClick={(e) => { if (!prevChapter) e.preventDefault(); }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  prevChapter ? "bg-zinc-800 hover:bg-zinc-700" : "bg-zinc-800/40 cursor-not-allowed"
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
                Bab Sebelumnya
              </Link>

              <Link
                href={`/novel/${params.slug}#toc`}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
              >
                <List className="h-4 w-4" />
                Daftar Isi
              </Link>

              <Link
                href={nextHref}
                onClick={(e) => { if (!nextChapter) e.preventDefault(); }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  nextChapter ? "bg-sky-600 hover:bg-sky-500" : "bg-sky-600/40 cursor-not-allowed"
                }`}
              >
                Bab Berikutnya
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Komentar + Reactions */}
            <div id="comments" className="mt-10">
              <CommentsSection chapterId={String((chapter as any).id)} />
            </div>
          </>
        )}
      </main>

      {/* FLOATING CONTROL BAR — upgraded */}
      <div
        className={`fixed inset-x-0 bottom-6 z-40 transition-opacity ${
          showUI ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="mx-auto w-[min(820px,94vw)] rounded-2xl bg-zinc-900/80 px-4 pt-3 pb-2 shadow-xl ring-1 ring-white/10 backdrop-blur"
          onClick={(e) => { e.stopPropagation(); toggleUI(); }}
        >
          {/* progress + seek */}
          <div className="mb-3 flex items-center gap-3">
            <span className="w-12 text-right text-xs tabular-nums text-zinc-300">
              {progress.toFixed(0)}%
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="w-full accent-sky-500"
            />
            <span className="w-20 text-right text-xs text-sky-300/90">
              ~{estMin}m
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            {/* left cluster */}
            <div className="flex items-center gap-2">
              <Link
                href={prevHref}
                onClick={(e) => { if (!prevChapter) e.preventDefault(); }}
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  prevChapter ? "bg-zinc-800 hover:bg-zinc-700" : "bg-zinc-800/40 cursor-not-allowed"
                }`}
                aria-label="Bab sebelumnya"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>

              <button
                onClick={(e) => { e.stopPropagation(); setShowSettings((s) => !s); }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700"
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>

            {/* center cluster */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setFontScale((v) => Math.max(0.85, v - 0.05)); }}
                className="rounded-full bg-zinc-800 px-3 py-1 text-sm hover:bg-zinc-700"
                title="A-"
              >
                <Type className="mr-1 inline h-4 w-4" />–
              </button>

              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-zinc-900 hover:bg-zinc-200">
                <button
                  onClick={(e) => { e.stopPropagation(); setAutoScroll((v) => !v); }}
                  className="inline-flex"
                  aria-label={autoScroll ? "Pause auto scroll" : "Play auto scroll"}
                  title="Spasi = Play/Pause"
                >
                  {autoScroll ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </button>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); setFontScale((v) => Math.min(1.25, v + 0.05)); }}
                className="rounded-full bg-zinc-800 px-3 py-1 text-sm hover:bg-zinc-700"
                title="A+"
              >
                <Type className="mr-1 inline h-4 w-4" />+
              </button>

              {/* mini speed slider */}
              <input
                type="range"
                min={20}
                max={200}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-32 accent-sky-500"
                title={`Speed: ${speed}px/s`}
              />
            </div>

            {/* right cluster */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  document.querySelector("#comments")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="rounded-full bg-zinc-800 px-3 py-1 text-sm hover:bg-zinc-700"
              >
                <MessageSquare className="mr-1 inline h-4 w-4" />
                Komentar
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); setImmersive((v) => !v); }}
                className="rounded-full bg-zinc-800 px-3 py-1 text-sm hover:bg-zinc-700"
              >
                {immersive ? "Exit" : "Immersive"}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setBookmarked((b) => !b);
                  const key = `bookmark:${params.slug}:${params.chapter}`;
                  const now = Date.now();
                  localStorage.setItem(key, JSON.stringify({ t: now, pct: progress }));
                  // TODO: sambungkan ke DB bookmark jika diperlukan.
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  bookmarked ? "bg-sky-600 hover:bg-sky-500" : "bg-zinc-800 hover:bg-zinc-700"
                }`}
                title="Bookmark"
                aria-label="Bookmark"
              >
                <Bookmark className="h-5 w-5" />
              </button>

              <Link
                href={nextHref}
                onClick={(e) => { if (!nextChapter) e.preventDefault(); }}
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  nextChapter ? "bg-sky-600 hover:bg-sky-500" : "bg-sky-600/40 cursor-not-allowed"
                }`}
                aria-label="Bab berikutnya"
              >
                <ChevronRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* SIDE UP/DOWN BUTTONS */}
      <div
        className={`fixed bottom-6 right-6 z-40 flex flex-col gap-3 transition-opacity ${
          showUI ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.scrollBy({ top: -window.innerHeight * 0.9, behavior: "smooth" });
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900/80 ring-1 ring-white/10 backdrop-blur hover:bg-zinc-800"
          aria-label="Scroll up"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" });
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900/80 ring-1 ring-white/10 backdrop-blur hover:bg-zinc-800"
          aria-label="Scroll down"
        >
          <ChevronDown className="h-6 w-6" />
        </button>
      </div>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-[min(560px,95vw)] rounded-2xl bg-zinc-900 p-5 shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-lg font-semibold">Reader Settings</h3>
            <div className="space-y-5">
              <div>
                <label className="mb-1 block text-sm opacity-80">
                  Auto-scroll speed (px/s)
                </label>
                <input
                  type="range"
                  min={20}
                  max={200}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
                <div className="mt-1 text-sm opacity-70">{speed} px/s</div>
              </div>

              <div>
                <label className="mb-1 block text-sm opacity-80">Ukuran font</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFontScale((v) => Math.max(0.85, v - 0.05))}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
                  >
                    A–
                  </button>
                  <div className="text-sm opacity-70">{(fontScale * 100).toFixed(0)}%</div>
                  <button
                    onClick={() => setFontScale((v) => Math.min(1.25, v + 0.05))}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
                  >
                    A+
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setImmersive((v) => !v);
                    setShowSettings(false);
                  }}
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
                >
                  {immersive ? "Keluar Mode Baca" : "Masuk Mode Baca"}
                </button>

                <button
                  onClick={() => setShowSettings(false)}
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
