"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Editor from "@/components/RichEditor";
import {
  Loader2,
  ArrowLeft,
  Send,
  Info,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
} from "lucide-react";

/* ===================== Types ===================== */
type Msg = { type: "success" | "error" | "info"; text: string };
type NovelLite = { id: string; title: string; cover_url: string | null; tags: string[] | null };

/* ===================== Helpers (untuk Preview) ===================== */
const looksLikeHTML = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);
const normalizePlain = (s: string) =>
  (s || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");

/** Markdown-lite (WhatsApp-style + basic headings) -> HTML */
function mdToHtml(src: string) {
  if (!src) return "";

  let s = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/\r\n/g, "\n");

  // Headings
  s = s.replace(/^###\s+(.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  s = s.replace(/^##\s+(.+)$/gm, '<h2 class="text-xl font-bold mt-5 mb-3">$1</h2>');
  s = s.replace(/^#\s+(.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>');

  // Code block ```
  s = s.replace(/```([\s\S]*?)```/g, (_m, code) =>
    `<pre class="my-3 rounded-lg border border-white/10 bg-black/30 p-3 overflow-x-auto"><code>${code}</code></pre>`
  );

  // Inline code
  s = s.replace(/`([^`]+?)`/g, '<code class="rounded bg-black/30 px-1 py-0.5">$1</code>');

  // WhatsApp-style emphasis
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");            // **bold**
  s = s.replace(/\*(?!\s)([^*]+?)(?<!\s)\*/g, "<strong>$1</strong>"); // *bold*
  s = s.replace(/_(?!\s)([^_]+?)(?<!\s)_/g, "<em>$1</em>");          // _italic_
  s = s.replace(/~(?!\s)([^~]+?)(?<!\s)~/g, "<del>$1</del>");        // ~strike~

  // Image
  s = s.replace(
    /!\[(.*?)\]\((.*?)\)/g,
    '<img src="$2" alt="$1" class="my-3 rounded border border-white/10 max-w-full" />'
  );

  // Blockquote (gabungkan baris berurutan)
  s = s.replace(/((?:^(?:&gt;|>)\s?.*(?:\n|$))+)/gm, (block) => {
    const inner = block
      .trimEnd()
      .split("\n")
      .map((l) => l.replace(/^(?:&gt;|>)\s?/, ""))
      .join("<br />");
    return `\n\n<blockquote class="my-3 border-l-2 pl-3 border-white/20 text-zinc-300">${inner}</blockquote>\n\n`;
  });

  // Paragraphs + single line breaks
  const parts = s.split(/\n{2,}/).map((seg) => {
    const t = seg.trim();
    if (/^<(h1|h2|h3|blockquote|pre|img)\b/i.test(t)) return t;
    return `<p>${t.replace(/\n/g, "<br />")}</p>`;
  });

  return parts.join("");
}

/* ===================== Halaman Write ===================== */
export default function WriteChapterClient() {
  const router = useRouter();
  const params = useSearchParams();
  const novelId = params.get("novel_id");

  // form (samakan pola dgn edit: { title, content })
  const [number, setNumber] = useState<number | "">("");
  const [form, setForm] = useState({ title: "", content: "" });

  // ui/meta
  const [novel, setNovel] = useState<NovelLite | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyMeta, setBusyMeta] = useState(true);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // preview tab (mobile)
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  // session ringan
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  // load meta novel + nomor berikutnya
  useEffect(() => {
    let alive = true;
    (async () => {
      setBusyMeta(true);
      try {
        if (!novelId) {
          setBusyMeta(false);
          return;
        }

        const { data: n } = await supabase
          .from("novels")
          .select("id, title, cover_url, tags")
          .eq("id", novelId)
          .maybeSingle();

        if (!alive) return;
        setNovel((n as any) || null);

        const { data: nums } = await supabase
          .from("chapters")
          .select("number")
          .eq("novel_id", novelId)
          .order("number", { ascending: false })
          .limit(1);

        if (!alive) return;

        if (nums && nums.length && typeof nums[0].number === "number") {
          setNumber((nums[0].number as number) + 1);
        } else {
          setNumber(1);
        }
      } catch (e: any) {
        setMsg({ type: "error", text: e?.message || "Gagal memuat metadata novel." });
        if (number === "") setNumber(1);
      } finally {
        if (alive) setBusyMeta(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novelId]);

  const resetForm = () => {
    setForm({ title: "", content: "" });
    if (typeof number === "number") setNumber(number + 1);
    setActiveTab("write");
  };

  async function handleSubmit() {
    setMsg(null);

    if (!novelId) {
      setMsg({ type: "error", text: "novel_id tidak ditemukan. Buka dari halaman metadata." });
      return;
    }
    if (!number || Number.isNaN(Number(number)) || Number(number) <= 0) {
      setMsg({ type: "error", text: "Nomor bab wajib diisi dan harus > 0." });
      return;
    }

    const plain = (form.content || "").replace(/<[^>]+>/g, "").trim();
    if (plain.length < 20) {
      setMsg({ type: "error", text: "Konten terlalu pendek (min. ±20 karakter)." });
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("Kamu belum login.");

      const { error: rpcErr } = await supabase.rpc("ensure_profile");
      if (rpcErr) throw new Error(rpcErr.message || "Gagal memastikan profil.");

      const payload = {
        novel_id: novelId,
        number: Number(number),
        title: (form.title || "").trim() || null,
        content: form.content ?? "", // ← isi dari Editor (sama dengan Edit)
        content_text: plain.slice(0, 4000) || null,
        status: "pending",
        author_id: user.id,
      };

      const { error } = await supabase.from("submission_chapters").insert(payload);
      if (error) throw new Error(error.message);

      setMsg({ type: "success", text: "Bab berhasil diajukan. Menunggu persetujuan admin." });
      resetForm();
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Gagal mengajukan bab." });
    } finally {
      setSubmitting(false);
    }
  }

  const novelTitle = useMemo(() => novel?.title ?? "(Novel tidak ditemukan)", [novel?.title]);

  /* ===================== Derived untuk Preview ===================== */
  const raw = String(form.content ?? "");
  const plain = useMemo(() => normalizePlain(raw), [raw]);
  const previewMode: "html" | "md" | "text" = useMemo(() => {
    if (!plain.trim()) return "text";
    if (looksLikeHTML(raw)) return "html";
    return "md";
  }, [raw, plain]);

  const previewHTML = useMemo(() => {
    if (previewMode === "html") return raw;
    if (previewMode === "md") return mdToHtml(plain);
    // text => paragraf
    const blocks = plain
      .replace(/\r\n/g, "\n")
      .trim()
      .split(/\n\s*\n+/)
      .map((p) => `<p class="mb-4 leading-8">${p.replace(/\n/g, "<br />")}</p>`)
      .join("");
    return blocks || `<p class="opacity-60">Belum ada konten…</p>`;
  }, [previewMode, plain, raw]);

  /* ===================== Loading meta ===================== */
  if (busyMeta) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
          <div className="mx-auto flex w-[min(980px,94vw)] items-center gap-2 px-3 py-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" /> Kembali
            </button>
            <div className="ml-2 truncate text-sm text-zinc-300">Menyiapkan editor…</div>
          </div>
        </header>
        <main className="mx-auto w-[min(980px,94vw)] px-3 py-8">
          <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
          </div>
        </main>
      </div>
    );
  }

  /* ===================== UI ===================== */
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100">
      {/* Header ringkas & elegan (sesuai desain write sebelumnya) */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex w-[min(980px,94vw)] items-center gap-2 px-3 py-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>

          <div className="ml-2 truncate text-sm text-zinc-300">
            Tulis Bab Baru {typeof number === "number" ? `#${number}` : ""} •{" "}
            <span className="text-zinc-400">{novelTitle}</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !novelId}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-500 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Ajukan
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-[min(980px,94vw)] px-3 py-6">
        {/* Info bar */}
        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-indigo-300" />
            <span>
              Status awal <span className="font-semibold text-indigo-300">pending</span>. Konten akan ditinjau moderator sebelum tayang.
              {userEmail ? <> &nbsp;•&nbsp; Masuk sebagai <span className="text-zinc-200">{userEmail}</span></> : null}
            </span>
          </div>
        </div>

        {/* Meta Novel */}
        {novelId ? (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
            {novel?.cover_url ? (
              <img src={novel.cover_url} alt="" className="h-12 w-9 rounded border border-white/10 object-cover" />
            ) : (
              <div className="grid h-12 w-9 place-items-center rounded border border-white/10 bg-white/5 text-[10px] text-zinc-400">
                No Cover
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{novelTitle}</div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {(novel?.tags || []).map((t) => (
                  <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="ml-auto text-xs text-zinc-400">
              <BookOpen className="mr-1 inline h-3.5 w-3.5" />
              ID: {novelId.slice(0, 8)}…
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>
                <span className="font-semibold">novel_id</span> tidak ada. Buka dari halaman metadata novel agar parameter ikut terisi.{" "}
                <Link href="/write" className="underline">Kembali ke metadata</Link>
              </span>
            </div>
          </div>
        )}

        {/* Kartu utama: kiri tulis, kanan preview (responsive) */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          {/* Nomor & Judul */}
          <div className="grid gap-3 sm:grid-cols-[140px,1fr]">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Nomor Bab</label>
              <input
                type="number"
                min={1}
                value={number}
                onChange={(e) => setNumber(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="1"
                className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/70"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Judul Bab (opsional)</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={typeof number === "number" ? `Mis. Bab ${number}` : "Judul bab"}
                className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/70"
              />
            </div>
          </div>

          {/* Tabs mobile */}
          <div className="mt-4 grid grid-cols-2 gap-2 lg:hidden">
            <button
              onClick={() => setActiveTab("write")}
              className={`rounded-xl px-3 py-2 text-sm ${
                activeTab === "write"
                  ? "bg-indigo-600 text-white"
                  : "border border-white/10 bg-zinc-950/60"
              }`}
            >
              Tulis
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={`rounded-xl px-3 py-2 text-sm ${
                activeTab === "preview"
                  ? "bg-indigo-600 text-white"
                  : "border border-white/10 bg-zinc-950/60"
              }`}
            >
              Pratinjau
            </button>
          </div>

          {/* Grid 2 kolom untuk ≥lg: editor kiri, preview kanan */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Kolom Editor (selalu tampil; di mobile disembunyikan saat tab Preview) */}
            <div className={activeTab === "preview" ? "hidden lg:block" : "block"}>
              <label className="mb-1 block text-xs text-zinc-400">Isi Bab</label>
              <Editor value={form.content} setValue={(v) => setForm({ ...form, content: v })} />
              <div className="mt-2 text-xs text-zinc-400">
                Gunakan toolbar untuk format dasar. Dukungan *teks*, _teks_, ~teks~, `kode`, &gt; kutipan, dan heading.
              </div>
            </div>

            {/* Kolom Preview */}
            <div className={activeTab === "write" ? "hidden lg:block" : "block"}>
              <label className="mb-1 block text-xs text-zinc-400">Pratinjau</label>
              <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-4">
                {/* Judul pratinjau */}
                <div className="mb-3">
                  <div className="text-lg font-bold text-indigo-300">
                    {form.title?.trim() || (typeof number === "number" ? `Bab ${number}` : "Judul Bab")}
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">{novelTitle}</div>
                </div>

                {/* Isi pratinjau */}
                <div
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewHTML }}
                />
              </div>
            </div>
          </div>

          {/* Notif */}
          {msg && (
            <div
              className={[
                "mt-4 rounded-xl border p-3 text-sm",
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
            </div>
          )}
        </div>
      </main>

      {/* Bottom actions */}
      <div className="sticky bottom-0 z-40 border-t border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex w-[min(980px,94vw)] items-center justify-between gap-3 px-3 py-3">
          <div className="text-xs text-zinc-400">
            Menulis: <span className="text-zinc-300">{novelTitle}</span>
            {typeof number === "number" ? <> • Bab {number}</> : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetForm}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-60"
            >
              Reset
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !novelId}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-500 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Ajukan Bab
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
