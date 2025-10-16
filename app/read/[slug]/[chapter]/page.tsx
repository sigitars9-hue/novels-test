"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Novel, Chapter } from "@/lib/db";

import DOMPurify from "dompurify";
import {
  ArrowLeft,
  Home,
  Settings,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import CommentsSection from "@/components/CommentsSection";

/* ===== Helpers ===== */
const WPM = 220;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const looksLikeHTML = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);

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
/** Normalisasi ringan supaya input lama yang mengandung NBSP/zero-width nggak bikin aneh */
function normalizePlain(s: string) {
  return (s || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function mdToHtml(src: string) {
  if (!src) return "";

  // 1) Escape dasar (supaya aman dulu)
  let s = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2) Heading
  s = s.replace(/^###\s+(.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  s = s.replace(/^##\s+(.+)$/gm,  '<h2 class="text-xl font-bold mt-5 mb-3">$1</h2>');
  s = s.replace(/^#\s+(.+)$/gm,   '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>');

  // 3) Blockquote (dukung '>' yang sudah jadi &gt;)
  s = s.replace(/^(?:&gt;|>)\s?(.*)$/gm,
    '<blockquote class="my-3 border-l-2 pl-3 border-white/20 text-zinc-400">$1</blockquote>'
  );

  // 4) Blok kode ```...``` (jangan di-escape lagi)
  s = s.replace(/```([\s\S]*?)```/g,
    (_m, code) =>
      `<pre class="my-3 rounded-lg border border-white/10 bg-black/30 p-3 overflow-x-auto"><code>${code}</code></pre>`
  );

  // 5) Inline code
  s = s.replace(/`([^`]+?)`/g, '<code class="rounded bg-black/30 px-1 py-0.5">$1</code>');

  // 6) WhatsApp-style + kompat lama (**bold**)
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");           // **bold** (konten lama)
  s = s.replace(/\*(?!\s)([^*]+?)(?<!\s)\*/g, "<strong>$1</strong>"); // *bold*
  s = s.replace(/_(?!\s)([^_]+?)(?<!\s)_/g, "<em>$1</em>");           // _italic_
  s = s.replace(/~(?!\s)([^~]+?)(?<!\s)~/g, "<del>$1</del>");         // ~strike~

  // 7) Gambar
  s = s.replace(
    /!\[(.*?)\]\((.*?)\)/g,
    '<img src="$2" alt="$1" class="my-3 rounded border border-white/10 max-w-full" />'
  );

  // 8) Paragraf & line break
  s = s.replace(/\r\n/g, "\n");

  // Bagi per 2+ newline (paragraf). Untuk segmen yang SUDAH elemen blok, biarkan.
  const parts = s.split(/\n{2,}/).map(seg => {
    const trimmed = seg.trim();
    // kalau dia mulai dengan elemen blok, jangan bungkus <p>
    if (/^<(h1|h2|h3|blockquote|pre|img)\b/i.test(trimmed)) {
      return trimmed;
    }
    // selain itu, enter tunggal -> <br />
    const withBr = trimmed.replace(/\n/g, "<br />");
    return `<p>${withBr}</p>`;
  });

  return parts.join("");
}

/** Deteksi pola "WhatsApp-style" agar kita render via mdToHtml */
function looksLikeWhatsAppMD(s: string) {
  return (
    /(^|\n)>\s?/.test(s) ||               // quote
    /```[\s\S]*?```/.test(s) ||           // code fence
    /`[^`]+`/.test(s) ||                  // inline code
    /\*(?!\s)[^*]+?(?<!\s)\*/.test(s) ||  // *bold*
    /_(?!\s)[^_]+?(?<!\s)_/.test(s) ||    // _italic_
    /~(?!\s)[^~]+?(?<!\s)~/.test(s) ||    // ~strike~
    /(^|\n)\s*#{1,3}\s+/.test(s) ||       // headings
    /!\[.*?\]\(.*?\)/.test(s)             // image
  );
}

/** Util kelas tema */
function themeCls(isLight: boolean, light: string, dark: string) {
  return isLight ? light : dark;
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
  const [uiVisible, setUiVisible] = useState(true);
  const lastY = useRef(0);

  // Auto-scroll
  const [autoScroll, setAutoScroll] = useState(false);
  const [speed, setSpeed] = useState(60); // px/s
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);

  // Theme – default dark, bisa "light"
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const isLight = theme === "light";

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);

  // HUD docking (berhenti sebelum komentar)
  const [docked, setDocked] = useState(false);
  const dockSentinelRef = useRef<HTMLDivElement | null>(null);

  // load/persist theme
  useEffect(() => {
    const t = (localStorage.getItem("readerTheme") as "dark" | "light" | null) || "dark";
    setTheme(t);
  }, []);
  useEffect(() => {
    localStorage.setItem("readerTheme", theme);
  }, [theme]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => setDocked(entries[0].isIntersecting),
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

  /* ===== Data turunan ===== */
  const raw = String(chapter?.content ?? "");
  const plain = useMemo(() => normalizePlain(raw), [raw]);

  /** Mode render:
   * - "html": memang HTML
   * - "md-old": markdown WhatsApp-style (mdToHtml)
   * - "text": fallback paragraf biasa
   */
  const mode: "html" | "md-old" | "text" = useMemo(() => {
    if (!plain.trim()) return "text";
    if (looksLikeHTML(raw)) return "html";
    return looksLikeWhatsAppMD(plain) ? "md-old" : "text";
  }, [raw, plain]);

  const sanitizedHTML = useMemo(
    () => (mode === "html" ? DOMPurify.sanitize(raw) : ""),
    [mode, raw]
  );

  const words = useMemo(() => {
    return looksLikeHTML(raw) ? countWords(stripHtml(raw)) : countWords(plain);
  }, [raw, plain]);
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
      className={themeCls(isLight, "min-h-screen bg-zinc-50 text-zinc-900", "min-h-screen bg-zinc-950 text-zinc-100")}
      onClick={() => { if (!uiVisible) setUiVisible(true); }}
    >
      {/* === TOP HUD === */}
      <div
        className={`sticky top-3 z-50 mx-auto w-[min(980px,94vw)] transition-opacity ${
          uiVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className={themeCls(
            isLight,
            "flex items-center justify-between rounded-2xl bg-white/85 px-4 py-3 ring-1 ring-black/10 backdrop-blur",
            "flex items-center justify-between rounded-2xl bg-zinc-900/90 px-4 py-3 ring-1 ring-white/10 backdrop-blur"
          )}
        >
          <Link
            href={`/novel/${params.slug}`}
            className={themeCls(
              isLight,
              "inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 ring-1 ring-black/10",
              "inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700"
            )}
            aria-label="Kembali"
          >
            <ArrowLeft className={themeCls(isLight, "h-5 w-5 text-zinc-800", "h-5 w-5")} />
          </Link>

          <div className="min-w-0 px-3 text-center">
            <div className={themeCls(isLight, "truncate font-semibold text-indigo-700", "truncate font-semibold text-indigo-300")}>
              {novel?.title ?? "—"}
            </div>
            <div className="truncate text-sm">
              <span className={themeCls(isLight, "opacity-60", "opacity-50")}>›</span>{" "}
              <span className={themeCls(isLight, "text-indigo-600", "text-indigo-400")}>
                {chapter ? `Ch ${chapter.number}` : "—"}
              </span>
            </div>
          </div>

          <Link
            href="/"
            className={themeCls(
              isLight,
              "inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 ring-1 ring-black/10",
              "inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700"
            )}
            aria-label="Beranda"
          >
            <Home className={themeCls(isLight, "h-5 w-5 text-zinc-800", "h-5 w-5")} />
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
        style={{ fontSize: `clamp(1rem, ${1}rem, 1.25rem)`, lineHeight: 1.9 }}
      >
        {!loading && !err && novel && chapter && (
          <section
            className={themeCls(
              isLight,
              "mb-4 rounded-2xl bg-white/70 p-4 ring-1 ring-black/10",
              "mb-4 rounded-2xl bg-zinc-900/60 p-4 ring-1 ring-white/10"
            )}
          >
            <h1 className={themeCls(isLight, "text-xl font-extrabold leading-tight text-indigo-700", "text-xl font-extrabold leading-tight text-indigo-300")}>
              {chapter.title ? chapter.title : `Bab ${chapter.number}`}
            </h1>
            <div className={themeCls(isLight, "mt-1 text-xs text-zinc-600", "mt-1 text-xs text-zinc-300/90")}>
              {novel.title} · {words} kata · ~{estMin} menit baca
            </div>
          </section>
        )}

        {loading && (
          <div className={themeCls(
            isLight,
            "mx-auto mt-10 w-fit rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700",
            "mx-auto mt-10 w-fit rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm"
          )}>
            Memuat…
          </div>
        )}

        {!loading && err && (
          <div className={themeCls(
            isLight,
            "mx-auto mt-10 w-fit rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700",
            "mx-auto mt-10 w-fit rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200"
          )}>
            {err}
          </div>
        )}

        {!loading && !err && (!novel || !chapter) && (
          <div className={themeCls(
            isLight,
            "mx-auto mt-10 w-fit rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700",
            "mx-auto mt-10 w-fit rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm"
          )}>
            Bab tidak ditemukan.
          </div>
        )}

        {!loading && !err && novel && chapter && (
          <>
            {/* Isi bab */}
            <article className={themeCls(isLight, "prose max-w-none", "prose prose-invert max-w-none")}>
              {mode === "html" && (
                <div
                  className={themeCls(isLight, "prose max-w-none", "prose prose-invert max-w-none")}
                  dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
                />
              )}

              {mode === "md-old" && (
                <div
                  className={themeCls(isLight, "prose max-w-none", "prose prose-invert max-w-none")}
                  dangerouslySetInnerHTML={{ __html: mdToHtml(plain) }}
                />
              )}

              {mode === "text" && (
                <div className="max-w-none">
                  {plain
                    .replace(/\r\n/g, "\n")
                    .trim()
                    .split(/\n\s*\n+/)
                    .map((p, i) => (
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

      {/* === FLOATING CIRCLES BAR === */}
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
                onClick={() => window.scrollBy({ top: -window.innerHeight * 0.9, behavior: "smooth" })}
                className={themeCls(
                  isLight,
                  "grid h-12 w-12 place-items-center rounded-full bg-white/85 ring-1 ring-black/10 backdrop-blur hover:bg-white",
                  "grid h-12 w-12 place-items-center rounded-full bg-zinc-900/90 ring-1 ring-white/10 backdrop-blur hover:bg-zinc-800"
                )}
                aria-label="Up"
              >
                <ChevronUp className={themeCls(isLight, "h-6 w-6 text-zinc-800", "h-6 w-6")} />
              </button>
              <button
                onClick={() => window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" })}
                className={themeCls(
                  isLight,
                  "grid h-12 w-12 place-items-center rounded-full bg-white/85 ring-1 ring-black/10 backdrop-blur hover:bg-white",
                  "grid h-12 w-12 place-items-center rounded-full bg-zinc-900/90 ring-1 ring-white/10 backdrop-blur hover:bg-zinc-800"
                )}
                aria-label="Down"
              >
                <ChevronDown className={themeCls(isLight, "h-6 w-6 text-zinc-800", "h-6 w-6")} />
              </button>
            </div>

            {/* Bubbles utama */}
            <div className={themeCls(
              isLight,
              "pointer-events-auto mx-auto flex gap-4 rounded-full bg-zinc-900/5 p-2 ring-1 ring-black/10",
              "pointer-events-auto mx-auto flex gap-4 rounded-full bg-black/20 p-2"
            )}>
              <Link
                href={prevHref}
                onClick={(e) => { if (!prevChapter) e.preventDefault(); }}
                className={themeCls(
                  isLight,
                  "grid h-12 w-12 place-items-center rounded-full bg-white/85 ring-1 ring-black/10 backdrop-blur hover:bg-white",
                  "grid h-12 w-12 place-items-center rounded-full bg-zinc-900/90 ring-1 ring-white/10 backdrop-blur hover:bg-zinc-800"
                )}
                aria-label="Sebelumnya"
              >
                <ArrowLeft className={themeCls(isLight, "h-6 w-6 text-zinc-800", "h-6 w-6")} />
              </Link>

              <button
                onClick={() => setShowSettings(true)}
                className={themeCls(
                  isLight,
                  "grid h-12 w-12 place-items-center rounded-full bg-white/85 ring-1 ring-black/10 backdrop-blur hover:bg-white",
                  "grid h-12 w-12 place-items-center rounded-full bg-zinc-900/90 ring-1 ring-white/10 backdrop-blur hover:bg-zinc-800"
                )}
                aria-label="Settings"
              >
                <Settings className={themeCls(isLight, "h-6 w-6 text-zinc-800", "h-6 w-6")} />
              </button>

              <button
                onClick={() => setAutoScroll((v) => !v)}
                className={themeCls(
                  isLight,
                  "grid h-12 w-12 place-items-center rounded-full bg-indigo-600 text-white ring-1 ring-black/10 backdrop-blur hover:bg-indigo-500",
                  "grid h-12 w-12 place-items-center rounded-full bg-indigo-600 text-white ring-1 ring-white/10 backdrop-blur hover:bg-indigo-500"
                )}
                aria-label={autoScroll ? "Pause" : "Play"}
              >
                {autoScroll ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
              </button>

              <Link
                href={nextHref}
                onClick={(e) => { if (!nextChapter) e.preventDefault(); }}
                className={themeCls(
                  isLight,
                  "grid h-12 w-12 place-items-center rounded-full bg-white/85 ring-1 ring-black/10 backdrop-blur hover:bg-white",
                  "grid h-12 w-12 place-items-center rounded-full bg-zinc-900/90 ring-1 ring-white/10 backdrop-blur hover:bg-zinc-800"
                )}
                aria-label="Bab berikutnya"
                title="Bab berikutnya"
              >
                <ChevronRight className={themeCls(isLight, "h-6 w-6 text-zinc-800", "h-6 w-6")} />
              </Link>

              <Link
                href="/"
                className={themeCls(
                  isLight,
                  "grid h-12 w-12 place-items-center rounded-full bg-white/85 ring-1 ring-black/10 backdrop-blur hover:bg-white",
                  "grid h-12 w-12 place-items-center rounded-full bg-zinc-900/90 ring-1 ring-white/10 backdrop-blur hover:bg-zinc-800"
                )}
                aria-label="Beranda"
              >
                <Home className={themeCls(isLight, "h-6 w-6 text-zinc-800", "h-6 w-6")} />
              </Link>
            </div>

            <div className="w-12" />
          </div>
        </div>
      </div>

      {/* === SETTINGS: Mode Terang === */}
      {showSettings && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            className={themeCls(
              isLight,
              "w-[min(560px,95vw)] rounded-2xl bg-white p-5 ring-1 ring-black/10",
              "w-[min(560px,95vw)] rounded-2xl bg-zinc-900 p-5 ring-1 ring-white/10"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={themeCls(isLight, "text-lg font-semibold text-zinc-900", "text-lg font-semibold")}>
              Pengaturan
            </h3>

            <div className="mt-5 space-y-5">
              <div
                className={themeCls(
                  isLight,
                  "flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-3",
                  "flex items-center justify-between rounded-xl border border-white/10 bg-zinc-800/60 px-3 py-3"
                )}
              >
                <div>
                  <div className={themeCls(isLight, "text-sm font-semibold text-zinc-900", "text-sm font-semibold")}>
                    Mode Terang
                  </div>
                  <div className={themeCls(isLight, "text-xs text-zinc-600", "text-xs text-zinc-400")}>
                    Aktifkan tampilan terang untuk halaman baca ini.
                  </div>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
                  className={isLight ? "relative h-7 w-12 rounded-full bg-indigo-600 transition-colors"
                                      : "relative h-7 w-12 rounded-full bg-zinc-500/50 transition-colors"}
                  aria-label="Toggle Mode Terang"
                >
                  <span
                    className={isLight
                      ? "absolute left-[calc(100%-1.65rem)] top-0.5 inline-block h-6 w-6 rounded-full bg-white shadow"
                      : "absolute left-0.5 top-0.5 inline-block h-6 w-6 rounded-full bg-white shadow"}
                  />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className={themeCls(
                    isLight,
                    "rounded-lg bg-zinc-100 px-4 py-2 text-sm text-zinc-800 ring-1 ring-black/10 hover:bg-zinc-200",
                    "rounded-lg bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
                  )}
                >
                  Tutup
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className={themeCls(
                    isLight,
                    "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500",
                    "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500"
                  )}
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
