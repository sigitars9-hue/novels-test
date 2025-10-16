"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Editor from "@/components/RichEditor";
import { Loader2, ArrowLeft, Save } from "lucide-react";

/* ───────────────── Types ───────────────── */
type Novel = {
  id: string;
  slug: string;
  title: string;
  author_id: string;
};

/* ===== Helpers untuk Preview (samakan dengan halaman write) ===== */
const looksLikeHTML = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);
const normalizePlain = (s: string) =>
  (s || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");

function mdToHtml(src: string) {
  if (!src) return "";
  let s = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/\r\n/g, "\n");

  // Headings
  s = s.replace(/^###\s+(.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  s = s.replace(/^##\s+(.+)$/gm, '<h2 class="text-xl font-bold mt-5 mb-3">$1</h2>');
  s = s.replace(/^#\s+(.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>');

  // Code block & inline
  s = s.replace(/```([\s\S]*?)```/g, (_m, code) =>
    `<pre class="my-3 rounded-lg border border-white/10 bg-black/30 p-3 overflow-x-auto"><code>${code}</code></pre>`
  );
  s = s.replace(/`([^`]+?)`/g, '<code class="rounded bg-black/30 px-1 py-0.5">$1</code>');

  // WhatsApp-style emphasis
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(?!\s)([^*]+?)(?<!\s)\*/g, "<strong>$1</strong>");
  s = s.replace(/_(?!\s)([^_]+?)(?<!\s)_/g, "<em>$1</em>");
  s = s.replace(/~(?!\s)([^~]+?)(?<!\s)~/g, "<del>$1</del>");

  // Image
  s = s.replace(
    /!\[(.*?)\]\((.*?)\)/g,
    '<img src="$2" alt="$1" class="my-3 rounded border border-white/10 max-w-full" />'
  );

  // Blockquote (gabungkan baris > berurutan)
  s = s.replace(/((?:^(?:&gt;|>)\s?.*(?:\n|$))+)/gm, (block) => {
    const inner = block
      .trimEnd()
      .split("\n")
      .map((l) => l.replace(/^(?:&gt;|>)\s?/, ""))
      .join("<br />");
    return `\n\n<blockquote class="my-3 border-l-2 pl-3 border-white/20 text-zinc-300">${inner}</blockquote>\n\n`;
  });

  // Paragraf & single line breaks
  const parts = s.split(/\n{2,}/).map((seg) => {
    const t = seg.trim();
    if (/^<(h1|h2|h3|blockquote|pre|img)\b/i.test(t)) return t;
    return `<p>${t.replace(/\n/g, "<br />")}</p>`;
  });
  return parts.join("");
}

/* ───────────────── Page ───────────────── */
export default function WriteChapterPage() {
  const router = useRouter();
  const params = useParams(); // { slug }
  const slug = String(params?.slug || "");

  const [session, setSession] = useState<any>(null);
  const [novel, setNovel] = useState<Novel | null>(null);
  const [nextNumber, setNextNumber] = useState<number>(1);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // UI parity dengan halaman write
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  /* Session */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  const isOwner = useMemo(
    () => !!(session?.user?.id && novel?.author_id === session.user.id),
    [session?.user?.id, novel?.author_id]
  );

  /* Load novel + next chapter number */
  const loadData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setErr(null);
    try {
      const { data: n, error: e1 } = await supabase
        .from("novels")
        .select("id, slug, title, author_id")
        .eq("slug", slug)
        .single();
      if (e1) throw e1;
      setNovel(n as Novel);

      const { data: rows, error: e2 } = await supabase
        .from("chapters")
        .select("number")
        .eq("novel_id", (n as Novel).id)
        .order("number", { ascending: false })
        .limit(1);
      if (e2) throw e2;
      const last = rows?.[0]?.number ?? 0;
      const next = last + 1;
      setNextNumber(next);
      setTitle(`Bab ${next}`);
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function save() {
    setErr(null);
    if (!isOwner) return setErr("Anda bukan author novel ini.");
    if (!novel?.id) return setErr("Novel tidak ditemukan.");

    const titleTrim = (title || "").trim();
    const finalTitle = titleTrim.length > 0 ? titleTrim : `Bab ${nextNumber}`;
    const finalContent = content ?? "";
    if (!finalContent.trim()) return setErr("Konten wajib diisi.");

    setSaving(true);
    const { error } = await supabase.from("chapters").insert({
      novel_id: novel.id,
      number: nextNumber,
      title: finalTitle,
      content: finalContent,
      created_at: new Date().toISOString(),
    });
    setSaving(false);

    if (error) {
      setErr(error.message);
      return;
    }
    router.push(`/read/${slug}/${nextNumber}`);
  }

  /* ====== Preview derived (parity) ====== */
  const raw = String(content ?? "");
  const plain = useMemo(() => normalizePlain(raw), [raw]);
  const previewMode: "html" | "md" | "text" = useMemo(() => {
    if (!plain.trim()) return "text";
    if (looksLikeHTML(raw)) return "html";
    return "md";
  }, [raw, plain]);

  const previewHTML = useMemo(() => {
    if (previewMode === "html") return raw;
    if (previewMode === "md") return mdToHtml(plain);
    const blocks = plain
      .replace(/\r\n/g, "\n")
      .trim()
      .split(/\n\s*\n+/)
      .map((p) => `<p class="mb-4 leading-8">${p.replace(/\n/g, "<br />")}</p>`)
      .join("");
    return blocks || `<p class="opacity-60">Belum ada konten…</p>`;
  }, [previewMode, plain, raw]);

  /* ====== DOM patch: sembunyikan toolbar & preview bawaan Editor ====== */
  const editorWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = editorWrapRef.current;
    if (!root) return;
    const allButtons = Array.from(root.querySelectorAll("button"));
    const toolButtons = allButtons.filter((b) =>
      /^(H1|H2|H3|Bold|Italic|Insert img)$/i.test((b.textContent || "").trim())
    );
    if (toolButtons.length) {
      const container = toolButtons[0].closest("div");
      if (container) (container as HTMLElement).style.display = "none";
    }
    const labels = Array.from(root.querySelectorAll("div,section,span,h6"));
    labels.forEach((el) => {
      const txt = (el.textContent || "").trim().toLowerCase();
      if (txt === "preview" || txt === "pratinjau") {
        (el as HTMLElement).style.display = "none";
        const next = el.nextElementSibling as HTMLElement | null;
        if (next) next.style.display = "none";
      }
    });
  });

  /* ─────────────── UI ─────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto w-[min(1000px,96vw)] px-3 py-8">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
          </div>
        </main>
      </div>
    );
  }

  if (!novel) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto w-[min(1000px,96vw)] px-3 py-8">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {err ?? "Novel tidak ditemukan."}
          </div>
          <div className="mt-4">
            <Link href="/" className="text-sky-400 hover:underline">
              ← Kembali ke beranda
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header (parity dengan write) */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex w-[min(1000px,96vw)] items-center gap-2 px-3 py-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>

          <div className="ml-2 truncate text-sm text-zinc-300">
            Tulis Bab Baru • <span className="text-zinc-400">{novel.title}</span>
          </div>

          <div className="ml-auto">
            <button
              onClick={save}
              disabled={!isOwner || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </button>
          </div>
        </div>
      </header>

      {/* Body: kiri tulis, kanan preview; tab di mobile */}
      <main className="mx-auto w-[min(1000px,96vw)] px-3 py-5">
        {!isOwner && (
          <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            Anda bukan author dari novel <b>{novel.title}</b>.
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          {/* Nomor & Judul */}
          <div className="grid gap-3 sm:grid-cols-[140px,1fr]">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Nomor Bab</label>
              <input
                value={nextNumber}
                readOnly
                className="w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Judul Bab</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-600"
                placeholder={`Judul bab (mis. Bab ${nextNumber})`}
                disabled={!isOwner || saving}
              />
            </div>
          </div>

          {/* Tabs mobile */}
          <div className="mt-4 grid grid-cols-2 gap-2 lg:hidden">
            <button
              onClick={() => setActiveTab("write")}
              className={`rounded-xl px-3 py-2 text-sm ${
                activeTab === "write" ? "bg-indigo-600 text-white" : "border border-white/10 bg-zinc-900/70"
              }`}
            >
              Tulis
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={`rounded-xl px-3 py-2 text-sm ${
                activeTab === "preview" ? "bg-indigo-600 text-white" : "border border-white/10 bg-zinc-900/70"
              }`}
            >
              Pratinjau
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Editor */}
            <div className={activeTab === "preview" ? "hidden lg:block" : "block"}>
              <label className="mb-1 block text-xs text-zinc-400">Konten</label>
              <div ref={editorWrapRef} className="hide-editor-extras">
                <Editor value={content} setValue={setContent} />
              </div>
              <div className="mt-2 text-xs text-zinc-400">
                Format cepat: <code>*teks*</code> (tebal), <code>_teks_</code> (miring),{" "}
                <code>~teks~</code> (coret), <code>`kode`</code>, awali baris dengan <code>&gt; </code> untuk kutipan.
              </div>
            </div>

            {/* Preview */}
            <div className={activeTab === "write" ? "hidden lg:block" : "block"}>
              <label className="mb-1 block text-xs text-zinc-400">Pratinjau</label>
              <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
                <div className="mb-3">
                  <div className="text-lg font-bold text-indigo-300">
                    {title?.trim() || `Bab ${nextNumber}`}
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">{novel.title}</div>
                </div>
                <div
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewHTML }}
                />
              </div>
            </div>
          </div>

          {err && <div className="mt-3 text-sm text-red-400">{err}</div>}
        </div>
      </main>

      {/* Bottom bar */}
      <div className="sticky bottom-0 z-40 border-t border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex w-[min(1000px,96vw)] items-center justify-between gap-3 px-3 py-3">
          <div className="text-xs text-zinc-400">
            Menambah bab untuk: <span className="text-zinc-300">{novel.title}</span> • Bab {nextNumber}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={!isOwner || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Bab
            </button>
          </div>
        </div>
      </div>

      {/* CSS fallback agar toolbar/preview internal editor tetap hilang */}
      <style jsx global>{`
        .hide-editor-extras .editor-toolbar,
        .hide-editor-extras [data-editor-toolbar],
        .hide-editor-extras .md-toolbar,
        .hide-editor-extras .ql-toolbar,
        .hide-editor-extras .toolbar,
        .hide-editor-extras .tools,
        .hide-editor-extras .rich-toolbar {
          display: none !important;
        }
        .hide-editor-extras .editor-preview,
        .hide-editor-extras [data-preview],
        .hide-editor-extras .md-preview,
        .hide-editor-extras .preview,
        .hide-editor-extras .preview-label,
        .hide-editor-extras .editor-preview-label {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
