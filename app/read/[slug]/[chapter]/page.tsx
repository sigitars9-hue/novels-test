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
} from "lucide-react";

import CommentsSection from "@/components/CommentsSection";

/* ===== Helpers ===== */
const WPM = 220;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
function looksLikeHTML(s: string) {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}
function stripHtml(html: string) {
  const tmp = typeof window !== "undefined" ? document.createElement("div") : null;
  if (!tmp) return html;
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}
function countWords(s: string) {
  const t = (s || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}
/** Deteksi Markdown ketat: hanya jika benar-benar ada sintaks MD */
function detectMarkdownStrict(s: string) {
  const mdHeaderOrList = /(^|\n)\s*(#{1,6}\s|[-*]\s|\d+\.\s)/;
  const mdInline = /(\*\*.+\*\*|__.+__|`[^`]+`|~~.+~~|\[.+\]\(.+\)|!\[.*\]\(.+\))/;
  return mdHeaderOrList.test(s) || mdInline.test(s);
}

type ReaderPageProps = { params: { slug: string; chapter: string } };

export default function ReaderPage({ params }: ReaderPageProps) {
  /* ===== State ===== */
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // nav
  const [prevChapter, setPrevChapter] = useState<Chapter | null>(null);
  const [nextChapter, setNextChapter] = useState<Chapter | null>(null);

  // UI visibility
  const [uiVisible, setUiVisible] = useState(true); // tap to toggle
  const lastY = useRef(0);

  // Auto-scroll
  const [autoScroll, setAutoScroll] = useState(false);
  const [speed, setSpeed] = useState(60); // px/s
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [mirror, setMirror] = useState<string>("");
  const [fontScale, setFontScale] = useState(1);

  // HUD docking (berhenti sebelum komentar)
  const [docked, setDocked] = useState(false);
  const dockSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setDocked(e.isIntersecting);
      },
      { root: null, threshold: 0, rootMargin: "0px 0px -80px 0px" }
    );
    if (dockSentinelRef.current) obs.observe(dockSentinelRef.current);
    return () => obs.disconnect();
  }, []);

  /* ===== Fetch ===== */
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

        const num = parseInt(params.chapter, 10);
        if (n) {
          const { data: ch, error: e2 } = await supabase
            .from("chapters")
            .select("*")
            .eq("novel_id", (n as any).id)
            .eq("number", num)
            .maybeSingle();
          if (e2) throw e2;
          setChapter((ch as Chapter) || null);

          // prev/next
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
        }
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? "Gagal memuat data.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [params.slug, params.chapter]);

  /* ===== Mode konten & sanitasi ===== */
  const mode: "html" | "md" | "text" = useMemo(() => {
    const raw = String(chapter?.content ?? "");
    if (!raw.trim()) return "text";
    if (looksLikeHTML(raw)) return "html";
    return detectMarkdownStrict(raw) ? "md" : "text";
  }, [chapter?.content]);

  const sanitizedHTML = useMemo(() => {
    if (mode !== "html") return "";
    return DOMPurify.sanitize(String(chapter?.content ?? ""));
  }, [mode, chapter?.content]);

  // versi paragraf untuk TEKS biasa (tanpa sintaks MD)
  const textParagraphs = useMemo(() => {
    const raw = String(chapter?.content ?? "").replace(/\r\n/g, "\n").trim();
    if (!raw) return [];
    // Pisah paragraf di baris kosong; single enter tetap jadi baris baru (di class)
    return raw.split(/\n\s*\n+/).map((p) => p);
  }, [chapter?.content]);

  const words = useMemo(() => {
    const raw = String(chapter?.content ?? "");
    return looksLikeHTML(raw) ? countWords(stripHtml(raw)) : countWords(raw);
  }, [chapter?.content]);
  const estMin = Math.max(1, Math.round(words / WPM));

  /* ===== Auto-hide on scroll ===== */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const goingDown = y > lastY.current + 2;
      lastY.current = y;
      if (goingDown && uiVisible) setUiVisible(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [uiVisible]);

  /* ===== Auto-scroll loop ===== */
  useEffect(() => {
    if (!autoScroll) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = 0;
      return;
    }
    const step = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      window.scrollBy(0, speed * dt);

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

  /* ===== UI derived ===== */
  const prevHref =
    prevChapter && novel ? `/read/${params.slug}/${(prevChapter as any).number}` : "#";
  const nextHref =
    nextChapter && novel ? `/read/${params.slug}/${(nextChapter as any).number}` : "#";

  /* ===== Render ===== */
  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100"
      onClick={() => {
        if (!uiVisible) setUiVisible(true); // single tap untuk munculkan HUD
      }}
    >
      {/* === TOP HUD (desain tetap, warna biru gelap) === */}
      <div
        className={`sticky top-3 z-50 mx-auto w-[min(980px,94vw)] transition-opacity ${
          uiVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between rounded-2xl bg-zinc-900/90 px-4 py-3 ring-1 ring-white/10 backdrop-blur">
          <Link
            href={`/novel/${params.slug}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700"
            aria-label="Kembali"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="min-w-0 px-3 text-center">
            <div className="truncate font-semibold text-indigo-300">
              {novel?.title ?? "—"}
            </div>
            <div className="truncate text-sm">
              <span className="opacity-50">›</span>{" "}
              <span className="text-indigo-400">
                {chapter ? `Ch ${chapter.number}` : "—"}
              </span>
            </div>
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

      {/* === CONTENT === */}
      <main
        className="mx-auto w-[min(980px,94vw)] pb-24 pt-2"
        onClick={(e) => {
          if (uiVisible) {
            const t = e.target as HTMLElement;
            if (t.closest("a,button,input,textarea,select")) return;
            setUiVisible(false);
          }
        }}
        style={{
          fontSize: `clamp(1rem, ${fontScale}rem, 1.25rem)`,
          lineHeight: 1.9,
        }}
      >
        {!loading && !err && novel && chapter && (
          <section className="mb-4 rounded-2xl bg-zinc-900/60 p-4 ring-1 ring-white/10">
            <h1 className="text-xl font-extrabold leading-tight text-indigo-300">
              {chapter.title ? chapter.title : `Bab ${chapter.number}`}
            </h1>
            <div className="mt-1 text-xs text-zinc-300/90">
              {novel.title} · {words} kata · ~{estMin} menit baca
            </div>
          </section>
        )}

        {loading && (
          <div className="mx-auto mt-10 w-fit rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm">
            Memuat…
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
            {/* Isi bab: perbaikan Markdown & teks biasa */}
            <article className="prose prose-invert max-w-none">
              {mode === "html" && (
                <div
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
                />
              )}

              {mode === "md" && (
                <ReactMarkdown
                  remarkPlugins={[
                    remarkGfm,
                    remarkBreaks, // enter = line break
                  ]}
                  rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  components={{
                    // pastikan spasi/enter tidak “nempel”
                    p: (props) => (
                      <p className="whitespace-pre-wrap leading-8" {...props} />
                    ),
                    li: (props) => (
                      <li className="whitespace-pre-wrap" {...props} />
                    ),
                  }}
                >
                  {String(chapter.content ?? "")}
                </ReactMarkdown>
              )}

              {mode === "text" && (
                <div className="max-w-none">
                  {textParagraphs.map((p, i) => (
                    <p key={i} className="mb-4 whitespace-pre-wrap leading-8">
                      {p}
                    </p>
                  ))}
                </div>
              )}
            </article>

            {/* Sentinel untuk dock floating bar */}
            <div ref={dockSentinelRef} className="h-6" />

            {/* Komentar */}
            <section id="comments" className="mt-8">
              <CommentsSection chapterId={String((chapter as any).id)} />
            </section>
          </>
        )}
      </main>

      {/* === FLOATING CIRCLES BAR (tetap, warna ke indigo) === */}
      <div
        className={`${docked ? "relative" : "fixed"} inset-x-0 bottom-6 z-40 transition-opacity ${
          uiVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="mx-auto w-[min(720px,94vw)]">
          <div className="flex items-center justify-between px-3">
            {/* Up/Down di kanan */}
            <div className="pointer-events-auto fixed right-6 bottom-[112px] flex flex-col gap-3">
              <button
                onClick={() =>
                  window.scrollBy({ top: -window.innerHeight * 0.9, behavior: "smooth" })
                }
                className="grid h-12 w-12 place-items-center rounded-full bg-zinc-900/90 ring-1 ring-white/10 backdrop-blur hover:bg-zinc-800"
                aria-label="Up"
              >
                <ChevronUp className="h-6 w-6" />
              </button>
              <button
                onClick={() =>
                  window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" })
                }
                className="grid h-12 w-12 place-items-center rounded-full bg-zinc-900/90 ring-1 ring-white/10 backdrop-blur hover:bg-zinc-800"
                aria-label="Down"
              >
                <ChevronDown className="h-6 w-6" />
              </button>
            </div>

            {/* Bubbles utama – desain sama, aksen indigo */}
            <div className="pointer-events-auto mx-auto flex gap-4 rounded-full bg-black/20 p-2">
              <Link
                href={prevHref}
                onClick={(e) => {
                  if (!prevChapter) e.preventDefault();
                }}
                className="grid h-12 w-12 place-items-center rounded-full bg-zinc-900/90 ring-1 ring-white/10 backdrop-blur hover:bg-zinc-800"
                aria-label="Sebelumnya"
              >
                <ArrowLeft className="h-6 w-6" />
              </Link>

              <button
                onClick={() => setShowSettings(true)}
                className="grid h-12 w-12 place-items-center rounded-full bg-zinc-900/90 ring-1 ring-white/10 backdrop-blur hover:bg-zinc-800"
                aria-label="Settings"
              >
                <Settings className="h-6 w-6" />
              </button>

              <button
                onClick={() => setAutoScroll((v) => !v)}
                className="grid h-12 w-12 place-items-center rounded-full bg-indigo-600 text-white ring-1 ring-white/10 backdrop-blur hover:bg-indigo-500"
                aria-label={autoScroll ? "Pause" : "Play"}
              >
                {autoScroll ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
              </button>

              <Link
                href={nextHref}
                onClick={(e) => {
                  if (!nextChapter) e.preventDefault();
                }}
                className="grid h-12 w-12 place-items-center rounded-full bg-zinc-900/90 ring-1 ring-white/10 backdrop-blur hover:bg-zinc-800"
                aria-label="Daftar isi"
              >
                <List className="h-6 w-6" />
              </Link>

              <Link
                href="/"
                className="grid h-12 w-12 place-items-center rounded-full bg-zinc-900/90 ring-1 ring-white/10 backdrop-blur hover:bg-zinc-800"
                aria-label="Beranda"
              >
                <Home className="h-6 w-6" />
              </Link>
            </div>

            <div className="w-12" />
          </div>
        </div>
      </div>

      {/* === SETTINGS (tidak diubah, warna fokus ke indigo) === */}
      {showSettings && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-[min(560px,95vw)] rounded-2xl bg-zinc-900 p-5 ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Settings</h3>

            <div className="mt-5 space-y-5">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">Select mirror url</label>
                <div className="flex gap-2">
                  <select
                    value={mirror}
                    onChange={(e) => setMirror(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="">Default</option>
                    <option value="mirror-1">Mirror 1</option>
                    <option value="mirror-2">Mirror 2</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">Autoscroll Speed</label>
                <input
                  type="range"
                  min={20}
                  max={200}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <div className="mt-1 text-xs text-zinc-400">{speed} px/s</div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">Font size</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setFontScale((v) => clamp(v - 0.05, 0.9, 1.25))}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
                  >
                    A–
                  </button>
                  <div className="text-sm text-zinc-400">{Math.round(fontScale * 100)}%</div>
                  <button
                    onClick={() => setFontScale((v) => clamp(v + 0.05, 0.9, 1.25))}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
                  >
                    A+
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
                >
                  Later
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
