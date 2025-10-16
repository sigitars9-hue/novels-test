"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
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

/* ===================== Mini RichEditor (tanpa toolbar) ===================== */
function RichEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  // sinkronisasi value dari luar
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  // paste handler — bersihkan style/handler, jaga baris baru
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const html = e.clipboardData.getData("text/html");
      const text = e.clipboardData.getData("text/plain");

      if (html) {
        e.preventDefault();
        // buang style & on* attribute
        let clean = html
          .replace(/\sstyle=["'][^"']*["']/gi, "")
          .replace(/\s(on\w+)=["'][^"']*["']/gi, "");
        document.execCommand("insertHTML", false, clean);
      } else if (text) {
        e.preventDefault();
        const safe = text
          .split(/\r?\n/)
          .map((ln) =>
            ln.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          )
          .join("<br>");
        document.execCommand("insertHTML", false, safe);
      }
      if (ref.current) onChange(ref.current.innerHTML);
    };

    el.addEventListener("paste", onPaste as any);
    return () => el.removeEventListener("paste", onPaste as any);
  }, [onChange]);

  return (
    <div className="space-y-2">
      {/* Kolom isi bab */}
      <div
        ref={ref}
        contentEditable
        onInput={() => ref.current && onChange(ref.current.innerHTML)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        data-placeholder={placeholder || "Tulis di sini..."}
        className="
          min-h-[280px] w-full rounded-2xl border border-white/10 bg-zinc-950/60
          px-4 py-3 outline-none ring-1 ring-transparent transition focus:ring-indigo-500/70
          prose prose-invert max-w-none
          empty:before:text-zinc-500/70 empty:before:content-[attr(data-placeholder)]
        "
        style={{
          wordBreak: "break-word",
          paddingBottom: focused ? "4.5rem" : undefined, // ruang ekstra saat fokus
          scrollMarginBottom: "6rem",
        }}
      />

      {/* Hint: cara format manual (gaya WhatsApp) */}
      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
        <div className="mb-1 font-semibold text-zinc-200">Tip format cepat (ketik manual):</div>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Tebal: ketik <code className="rounded bg-white/10 px-1">*teks*</code>
          </li>
          <li>
            Miring: ketik <code className="rounded bg-white/10 px-1">_teks_</code>
          </li>
          <li>
            Kutipan/abu: awali baris dengan{" "}
            <code className="rounded bg-white/10 px-1">&gt; </code>
          </li>
        </ul>
        <div className="mt-2 text-[11px] text-zinc-400">
          (Catatan: ini hanya panduan pengetikan. Output halaman baca mengikuti
          renderer yang aktif.)
        </div>
      </div>
    </div>
  );
}

/* ===================== Halaman Write ===================== */
export default function WriteChapterClient() {
  const router = useRouter();
  const params = useSearchParams();
  const novelId = params.get("novel_id");

  // form
  const [number, setNumber] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [contentHTML, setContentHTML] = useState<string>("");

  // ui/meta
  const [novel, setNovel] = useState<NovelLite | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyMeta, setBusyMeta] = useState(true);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
    setTitle("");
    setContentHTML("");
    if (typeof number === "number") setNumber(number + 1);
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

    const plain = contentHTML.replace(/<[^>]+>/g, "").trim();
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
        title: title.trim() || null,
        content: contentHTML || null,
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
      {/* Header ringkas & elegan */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex w-[min(980px,94vw)] items-center gap-2 px-3 py-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>

          <div className="ml-2 truncate text-sm text-zinc-300">
            Tulis Bab {typeof number === "number" ? `#${number}` : ""} •{" "}
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
        {/* Info */}
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

        {/* Kartu utama minimalis */}
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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={typeof number === "number" ? `Mis. Bab ${number}` : "Judul bab"}
                className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/70"
              />
            </div>
          </div>

          {/* Editor (tanpa tombol, ada hint) */}
          <div className="mt-4">
            <label className="mb-1 block text-xs text-zinc-400">Isi Bab</label>
            <RichEditor value={contentHTML} onChange={setContentHTML} placeholder="Tulis isi bab di sini…" />
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
              onClick={() => {
                setTitle("");
                setContentHTML("");
              }}
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
