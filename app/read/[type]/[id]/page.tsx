"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import DOMPurify from "dompurify";
import {
  ArrowLeft, Home, Settings, Play, Pause,
  ChevronUp, ChevronDown, ChevronRight
} from "lucide-react";
import CommentsSection from "@/components/CommentsSection";

/* ================= Helpers (ambil dari reader lamamu) ================= */
const WPM = 220;
const looksLikeHTML = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

function stripHtml(html: string) {
  if (typeof window === "undefined") return html;
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}
function normalizePlain(s: string) {
  return (s || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}
function htmlToPlainPreserveBreaks(html: string) {
  if (!html) return "";
  let s = html.replace(/\r\n/g, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  const blocks = ["p","div","section","article","header","footer","main","aside","ul","ol","li","pre","blockquote","h1","h2","h3","h4","h5","h6","table","tr"];
  for (const t of blocks) {
    const reOpen  = new RegExp(`<${t}\\b[^>]*>`, "gi");
    const reClose = new RegExp(`</${t}>`, "gi");
    s = s.replace(reOpen, "\n").replace(reClose, "\n");
  }
  s = s.replace(/<\/?[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
function mdToHtml(src: string) {
  if (!src) return "";
  let s = src.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/^###\s+(.+)$/gm,'<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  s = s.replace(/^##\s+(.+)$/gm,'<h2 class="text-xl font-bold mt-5 mb-3">$1</h2>');
  s = s.replace(/^#\s+(.+)$/gm,'<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>');
  s = s.replace(/```([\s\S]*?)```/g,
    (_m, code) => `<pre class="my-3 rounded-lg border border-white/10 bg-black/30 p-3 overflow-x-auto"><code>${code}</code></pre>`);
  s = s.replace(/`([^`]+?)`/g, '<code class="rounded bg-black/30 px-1 py-0.5">$1</code>');
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(?!\s)([^*]+?)(?<!\s)\*/g, "<strong>$1</strong>");
  s = s.replace(/_(?!\s)([^_]+?)(?<!\s)_/g, "<em>$1</em>");
  s = s.replace(/~(?!\s)([^~]+?)(?<!\s)~/g, "<del>$1</del>");
  s = s.replace(/!\[(.*?)\]\((.*?)\)/g,'<img src="$2" alt="$1" class="my-3 rounded border border-white/10 max-w-full" />');
  s = s.replace(/((?:^(?:&gt;|>)\s?.*(?:\n|$))+)/gm, (block) => {
    const inner = block.trimEnd().split("\n").map(l => l.replace(/^(?:&gt;|>)\s?/, "")).join("<br />");
    return `\n\n<blockquote class="my-3 border-l-2 pl-3 border-white/20 text-zinc-400">${inner}</blockquote>\n\n`;
  });
  const parts = s.split(/\n{2,}/).map(seg => {
    const t = seg.trim();
    if (/^<(h1|h2|h3|blockquote|pre|img)\b/i.test(t)) return t;
    return `<p>${t.replace(/\n/g, "<br />")}</p>`;
  });
  return parts.join("");
}
function looksLikeWhatsAppMD(s: string) {
  return (
    /(^|\n)>\s?/.test(s) ||
    /```[\s\S]*?```/.test(s) ||
    /`[^`]+`/.test(s) ||
    /\*(?!\s)[^*]+?(?<!\s)\*/.test(s) ||
    /_(?!\s)[^_]+?(?<!\s)_/.test(s) ||
    /~(?!\s)[^~]+?(?<!\s)~/.test(s) ||
    /(^|\n)\s*#{1,3}\s+/.test(s) ||
    /!\[.*?\]\(.*?\)/.test(s)
  );
}
function themeCls(isLight: boolean, light: string, dark: string) {
  return isLight ? light : dark;
}
function countWords(s: string) {
  const t = (s || "").trim();
  return t ? t.split(/\s+/).length : 0;
}

/* ================= Types ================= */
type ChapterRow = {
  id: string;
  number: number | null;
  title: string | null;
  novel_id: string | null;
  comic_id: string | null;
  content?: string | null; // utk novel
};
type NovelRow = { id: string; title: string; slug?: string | null; cover_url?: string | null };
type ComicRow = { id: string; title: string; slug?: string | null };
type ImageRow = { id: string; url: string; ord: number };

/* ================= Page ================= */
export default function UnifiedReaderPage({ params }: { params: { type: "novel" | "comic"; id: string } }) {
  const search = useSearchParams();
  const token = search.get("token"); // kalau pakai unlisted token

  // shared UI state (dari reader novel lama)
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const isLight = theme === "light";
  const [uiVisible, setUiVisible] = useState(true);
  const lastY = useRef(0);
  const [autoScroll, setAutoScroll] = useState(false);
  const [speed, setSpeed] = useState(60);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const [showSettings, setShowSettings] = useState(false);
  const [docked, setDocked] = useState(false);
  const dockSentinelRef = useRef<HTMLDivElement | null>(null);

  // data
  const [chapter, setChapter] = useState<ChapterRow | null>(null);
  const [parent, setParent] = useState<(NovelRow | ComicRow) | null>(null); // novel/komik
  const [images, setImages] = useState<ImageRow[]>([]); // utk komik
  const [prevCh, setPrevCh] = useState<ChapterRow | null>(null);
  const [nextCh, setNextCh] = useState<ChapterRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  /* Theme persist */
  useEffect(() => {
    const t = (localStorage.getItem("readerTheme") as "dark" | "light" | null) || "dark";
    setTheme(t);
  }, []);
  useEffect(() => {
    localStorage.setItem("readerTheme", theme);
  }, [theme]);

  /* HUD dock */
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => setDocked(entries[0].isIntersecting),
      { root: null, threshold: 0, rootMargin: "0px 0px -80px 0px" }
    );
    if (dockSentinelRef.current) obs.observe(dockSentinelRef.current);
    return () => obs.disconnect();
  }, []);

  /* Auto-hide on scroll */
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

  /* Auto-scroll loop */
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

/* ================= Fetch by type + id ================= */
useEffect(() => {
  let mounted = true;
  setLoading(true);
  setErr(null);
  setImages([]);
  setChapter(null);
  setParent(null);
  setPrevCh(null);
  setNextCh(null);

  (async () => {
    try {
      // Apakah param pertama valid ('novel' atau 'comic')?
      const isUnified = params.type === "novel" || params.type === "comic";

      let ch: ChapterRow | null = null;
      let parentId: string | null = null;
      let parentField: "novel_id" | "comic_id" = "novel_id";

      if (isUnified) {
        // ===== MODE BARU: /read/novel|comic/<chapterId(UUID)>
        const { data: chArr, error: chErr } = await supabase
          .from("chapters")
          .select("*")
          .eq("id", params.id) // UUID
          .returns<ChapterRow[]>();
        if (chErr) throw chErr;
        ch = chArr?.[0] ?? null;
        if (!ch) throw new Error("Chapter tidak ditemukan.");

        if (params.type === "novel") {
          parentField = "novel_id";
          parentId = ch.novel_id;
          const { data: nov, error: novErr } = await supabase
            .from("novels")
            .select("id,title,slug,cover_url")
            .eq("id", parentId)
            .maybeSingle();
          if (novErr) throw novErr;
          setParent(nov ?? null);
          setImages([]);
        } else {
          parentField = "comic_id";
          parentId = ch.comic_id;
          const [{ data: com, error: comErr }, { data: imgs, error: imgErr }] = await Promise.all([
            supabase.from("comics").select("id,title,slug").eq("id", parentId).maybeSingle(),
            supabase.from("images").select("id,url,ord").eq("chapter_id", ch.id).order("ord", { ascending: true }).returns<ImageRow[]>(),
          ]);
          if (comErr) throw comErr;
          if (imgErr) throw imgErr;
          setParent(com ?? null);
          setImages(imgs ?? []);
        }
      } else {
        // ===== MODE LAMA: /read/<slug>/<chapterNumber>
        const slug = params.type;      // param pertama sebenarnya slug
        const numStr = params.id;      // param kedua sebenarnya nomor
        const num = Number(numStr);
        if (!Number.isFinite(num)) throw new Error("Nomor bab tidak valid.");

        // Coba sebagai novel dulu
        const { data: nov, error: novErr } = await supabase
          .from("novels")
          .select("id,title,slug,cover_url")
          .eq("slug", slug)
          .maybeSingle();

        if (!novErr && nov) {
          parentField = "novel_id";
          parentId = nov.id;
          const { data: chArr2, error: chErr2 } = await supabase
            .from("chapters")
            .select("*")
            .eq("novel_id", nov.id)
            .eq("number", num)
            .returns<ChapterRow[]>();
          if (chErr2) throw chErr2;
          ch = chArr2?.[0] ?? null;
          setParent(nov);
          setImages([]);
        } else {
          // Kalau bukan novel, coba komik
          const { data: com, error: comErr } = await supabase
            .from("comics")
            .select("id,title,slug")
            .eq("slug", slug)
            .maybeSingle();
          if (comErr) throw comErr;
          if (!com) throw new Error("Karya dengan slug ini tidak ditemukan.");

          parentField = "comic_id";
          parentId = com.id;

          const { data: chArr3, error: chErr3 } = await supabase
            .from("chapters")
            .select("*")
            .eq("comic_id", com.id)
            .eq("number", num)
            .returns<ChapterRow[]>();
          if (chErr3) throw chErr3;
          ch = chArr3?.[0] ?? null;
          setParent(com);

          if (ch?.id) {
            const { data: imgs, error: imgErr } = await supabase
              .from("images")
              .select("id,url,ord")
              .eq("chapter_id", ch.id)
              .order("ord", { ascending: true })
              .returns<ImageRow[]>();
            if (imgErr) throw imgErr;
            setImages(imgs ?? []);
          }
        }

        if (!ch) throw new Error("Chapter tidak ditemukan.");
      }

      setChapter(ch);

      // ===== Prev / Next (berdasarkan number di parent) =====
      const num = Number(ch.number ?? 0);
      const [{ data: prevArr }, { data: nextArr }] = await Promise.all([
        supabase
          .from("chapters")
          .select("*")
          .eq(parentField, parentId)
          .lt("number", num)
          .order("number", { ascending: false })
          .limit(1)
          .returns<ChapterRow[]>(),
        supabase
          .from("chapters")
          .select("*")
          .eq(parentField, parentId)
          .gt("number", num)
          .order("number", { ascending: true })
          .limit(1)
          .returns<ChapterRow[]>(),
      ]);

      setPrevCh(prevArr?.[0] ?? null);
      setNextCh(nextArr?.[0] ?? null);
    } catch (e: any) {
      setErr(e?.message ?? "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  })();

  return () => { mounted = false; };
}, [params.type, params.id]);


  /* ================= Derived for NOVEL content ================= */
  const raw = String(chapter?.content ?? "");
  const looksHtml = useMemo(() => looksLikeHTML(raw), [raw]);
  const plainRaw = useMemo(() => normalizePlain(raw), [raw]);
  const plainForParsing = useMemo(
    () => (looksHtml ? htmlToPlainPreserveBreaks(raw) : plainRaw),
    [looksHtml, raw, plainRaw]
  );
  const mode: "html" | "md-old" | "text" = useMemo(() => {
    if (!plainForParsing.trim()) return "text";
    if (looksHtml) return looksLikeWhatsAppMD(plainForParsing) ? "md-old" : "html";
    return looksLikeWhatsAppMD(plainForParsing) ? "md-old" : "text";
  }, [looksHtml, plainForParsing]);
  const sanitizedHTML = useMemo(() => (mode === "html" ? DOMPurify.sanitize(raw) : ""), [mode, raw]);
  const words = useMemo(() => (params.type === "novel" ? countWords(plainForParsing) : 0), [plainForParsing, params.type]);
  const estMin = Math.max(1, Math.round(words / WPM));

  /* ================= HREF prev/next ================= */
  const prevHref = prevCh ? `/read/${params.type}/${prevCh.id}` : "#";
  const nextHref = nextCh ? `/read/${params.type}/${nextCh.id}` : "#";

  /* ================= Render (UI novel dibagi dua isi) ================= */
  return (
    <div
      className={themeCls(isLight, "min-h-screen bg-zinc-50 text-zinc-900", "min-h-screen bg-zinc-950 text-zinc-100")}
      onClick={() => { if (!uiVisible) setUiVisible(true); }}
    >
      {/* TOP HUD */}
      <div className={`sticky top-3 z-50 mx-auto w-[min(980px,94vw)] transition-opacity ${uiVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div
          className={themeCls(
            isLight,
            "flex items-center justify-between rounded-2xl bg-white/85 px-4 py-3 ring-1 ring-black/10 backdrop-blur",
            "flex items-center justify-between rounded-2xl bg-zinc-900/90 px-4 py-3 ring-1 ring-white/10 backdrop-blur"
          )}
        >
          <Link
            href={params.type === "novel" ? `/novel/${(parent as any)?.slug ?? ""}` : `/comics/${(parent as any)?.slug ?? ""}`}
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
              {(parent as any)?.title ?? "—"}
            </div>
            <div className="truncate text-sm">
              <span className={themeCls(isLight, "opacity-60", "opacity-50")}>›</span>{" "}
              <span className={themeCls(isLight, "text-indigo-600", "text-indigo-400")}>
                {chapter?.number != null ? `Ch ${chapter.number}` : "—"}
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

      {/* CONTENT */}
      <main
        className="mx-auto w-[min(980px,94vw)] pb-24 pt-2"
        onClick={(e) => {
          if (uiVisible) {
            const t = e.target as HTMLElement;
            if (t.closest("a,button,input,textarea,select")) return;
            setUiVisible(false);
          }
        }}
        style={{ fontSize: `clamp(1rem, 1rem, 1.25rem)`, lineHeight: 1.9 }}
      >
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

        {!loading && !err && (!chapter || !parent) && (
          <div className={themeCls(
            isLight,
            "mx-auto mt-10 w-fit rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700",
            "mx-auto mt-10 w-fit rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm"
          )}>
            Data tidak ditemukan.
          </div>
        )}

        {!loading && !err && chapter && parent && (
          <>
            {/* Header judul bab */}
            <section
              className={themeCls(
                isLight,
                "mb-4 rounded-2xl bg-white/70 p-4 ring-1 ring-black/10",
                "mb-4 rounded-2xl bg-zinc-900/60 p-4 ring-1 ring-white/10"
              )}
            >
              <h1 className={themeCls(isLight, "text-xl font-extrabold leading-tight text-indigo-700", "text-xl font-extrabold leading-tight text-indigo-300")}>
                {chapter.title ? chapter.title : `Bab ${chapter.number ?? ""}`}
              </h1>

              {params.type === "novel" && (
                <div className={themeCls(isLight, "mt-1 text-xs text-zinc-600", "mt-1 text-xs text-zinc-300/90")}>
                  {(parent as any).title} · {countWords(htmlToPlainPreserveBreaks(chapter.content || ""))} kata · ~{estMin} menit baca
                </div>
              )}
            </section>

            {/* Isi: novel atau komik */}
            {params.type === "novel" ? (
              <article className={themeCls(isLight, "prose max-w-none", "prose prose-invert max-w-none")}>
                {mode === "html" && (
                  <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />
                )}
                {mode === "md-old" && (
                  <div dangerouslySetInnerHTML={{ __html: mdToHtml(plainForParsing) }} />
                )}
                {mode === "text" && (
                  <div className="max-w-none">
                    {plainForParsing
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
            ) : (
              <section className="space-y-3">
                {images.length === 0 ? (
                  <div className="opacity-70">Belum ada gambar.</div>
                ) : (
                  images.map((img) => (
                    <img
                      key={img.id}
                      src={img.url}
                      alt={`page-${img.ord}`}
                      className="w-full rounded-lg border border-white/10"
                      loading="lazy"
                    />
                  ))
                )}
              </section>
            )}

            {/* Sentinel untuk dock floating bar */}
            <div ref={dockSentinelRef} className="h-6" />

            {/* Komentar */}
            <section id="comments" className="mt-8">
              <CommentsSection chapterId={String(chapter.id)} />
            </section>
          </>
        )}
      </main>

      {/* FLOATING CIRCLES BAR */}
      <div className={`${docked ? "relative" : "fixed"} inset-x-0 bottom-6 z-40 transition-opacity ${uiVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="mx-auto w-[min(720px,94vw)]">
          <div className="flex items-center justify-between px-3">
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

            <div className={themeCls(
              isLight,
              "pointer-events-auto mx-auto flex gap-4 rounded-full bg-zinc-900/5 p-2 ring-1 ring-black/10",
              "pointer-events-auto mx-auto flex gap-4 rounded-full bg-black/20 p-2"
            )}>
              <Link
                href={prevHref}
                onClick={(e) => { if (!prevCh) e.preventDefault(); }}
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
                onClick={(e) => { if (!nextCh) e.preventDefault(); }}
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

      {/* SETTINGS */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={() => setShowSettings(false)}>
          <div
            className={themeCls(
              isLight,
              "w-[min(560px,95vw)] rounded-2xl bg-white p-5 ring-1 ring-black/10",
              "w-[min(560px,95vw)] rounded-2xl bg-zinc-900 p-5 ring-1 ring-white/10"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={themeCls(isLight, "text-lg font-semibold text-zinc-900", "text-lg font-semibold")}>Pengaturan</h3>
            <div className="mt-5 space-y-5">
              <div className={themeCls(
                isLight,
                "flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-3",
                "flex items-center justify-between rounded-xl border border-white/10 bg-zinc-800/60 px-3 py-3"
              )}>
                <div>
                  <div className={themeCls(isLight, "text-sm font-semibold text-zinc-900", "text-sm font-semibold")}>Mode Terang</div>
                  <div className={themeCls(isLight, "text-xs text-zinc-600", "text-xs text-zinc-400")}>Aktifkan tampilan terang untuk halaman baca ini.</div>
                </div>
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
