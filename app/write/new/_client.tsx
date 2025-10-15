"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import BottomBar from "@/components/BottomBar";
import {
  Loader2,
  Send,
  Info,
  CheckCircle2,
  AlertTriangle,
  Type,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  BookOpen,
} from "lucide-react";

function EditorToolbar({ exec, dense = false }: {
  exec: (cmd: string, val?: string) => void;
  dense?: boolean;
}) {
  const pad = dense ? "px-2 py-1" : "px-2.5 py-1.5";
  return (
    <div className={`
      flex items-center gap-1 rounded-xl border border-white/10
      bg-zinc-900/85 backdrop-blur shadow-sm
    `}>
      <button type="button" onClick={() => exec("bold")}      className={`rounded-lg ${pad} hover:bg-white/10`} title="Bold"><Bold className="h-4 w-4" /></button>
      <button type="button" onClick={() => exec("italic")}    className={`rounded-lg ${pad} hover:bg-white/10`} title="Italic"><Italic className="h-4 w-4" /></button>
      <button type="button" onClick={() => exec("underline")} className={`rounded-lg ${pad} hover:bg-white/10`} title="Underline"><Underline className="h-4 w-4" /></button>
      <span className="mx-1 h-5 w-px bg-white/10" />
      <button type="button" onClick={() => exec("formatBlock", "<h2>")} className={`rounded-lg ${pad} hover:bg-white/10`} title="Heading"><Type className="h-4 w-4" /></button>
      <button type="button" onClick={() => exec("insertUnorderedList")} className={`rounded-lg ${pad} hover:bg-white/10`} title="Bullet List"><List className="h-4 w-4" /></button>
      <button type="button" onClick={() => exec("insertOrderedList")}  className={`rounded-lg ${pad} hover:bg-white/10`} title="Numbered List"><ListOrdered className="h-4 w-4" /></button>
      <button
        type="button"
        onClick={() => {
          const url = prompt("Masukkan URL:");
          if (url) exec("createLink", url);
        }}
        className={`rounded-lg ${pad} hover:bg-white/10`}
        title="Insert Link"
      >
        <LinkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

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

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  return (
    <div className="space-y-2">
      {/* Kolom isi bab */}
      <div
        ref={ref}
        contentEditable
        onInput={() => ref.current && onChange(ref.current.innerHTML)}
        data-placeholder={placeholder || "Tulis di sini..."}
        className="
          min-h-[260px] w-full rounded-xl border border-white/10 bg-zinc-900
          px-3 py-3 outline-none ring-1 ring-transparent transition focus:ring-sky-500
          prose prose-invert max-w-none
          empty:before:text-zinc-500/70 empty:before:content-[attr(data-placeholder)]
        "
        style={{ wordBreak: "break-word" }}
      />

      {/* Toolbar dipindah ke bawah kolom */}
      <div className="pt-1">
        <EditorToolbar exec={exec} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────── */

type Msg = { type: "success" | "error" | "info"; text: string };
type NovelLite = { id: string; title: string; cover_url: string | null; tags: string[] | null };

export default function WriteChapterClient() {
  const params = useSearchParams();
  const novelId = params.get("novel_id");

  // form
  const [number, setNumber] = useState<number | "">("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [contentHTML, setContentHTML] = useState<string>("");

  // ui
  const [novel, setNovel] = useState<NovelLite | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // load user & novel meta
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      if (!novelId) return;
      const { data } = await supabase
        .from("novels")
        .select("id, title, cover_url, tags")
        .eq("id", novelId)
        .maybeSingle();
      setNovel((data as any) || null);

      const { data: nums } = await supabase
        .from("chapters")
        .select("number")
        .eq("novel_id", novelId)
        .order("number", { ascending: false })
        .limit(1);

      if (nums && nums.length && typeof nums[0].number === "number") {
        setNumber((nums[0].number as number) + 1);
      } else setNumber(1);
    })();
  }, [novelId]);

  const resetForm = () => {
    setChapterTitle("");
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
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("Kamu belum login.");

      const { error: rpcErr } = await supabase.rpc("ensure_profile");
      if (rpcErr) throw new Error(rpcErr.message || "Gagal memastikan profil.");

      const payload = {
        novel_id: novelId,
        number: Number(number),
        title: chapterTitle.trim() || null,
        content: contentHTML || null,
        content_text: plain.slice(0, 4000) || null,
        status: "pending",
        author_id: user.id, // PENTING — untuk RLS & moderasi
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* HERO */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_20%_-10%,rgba(125,211,252,.12),transparent),radial-gradient(700px_320px_at_80%_0%,rgba(147,197,253,.12),transparent)]" />
        <div className="mx-auto w-[min(980px,95vw)] px-4 py-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Tulis Bab (Pending Approval)</h1>
          <p className="mt-1 text-sm text-zinc-300/90">
            Bab akan masuk antrian moderasi. {userEmail ? `Masuk sebagai ${userEmail}.` : ""}
          </p>

          {novelId ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/60 p-3">
              {novel?.cover_url ? (
                <img src={novel.cover_url} alt="" className="h-12 w-9 rounded border border-white/10 object-cover" />
              ) : (
                <div className="grid h-12 w-9 place-items-center rounded border border-white/10 bg-white/5 text-[10px] text-zinc-400">
                  No Cover
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{novel?.title || "(Novel tidak ditemukan)"}</div>
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
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              novel_id tidak ada. Buka dari halaman metadata novel agar parameter ikut terisi.{" "}
              <Link href="/write" className="underline">Kembali ke metadata</Link>
            </div>
          )}
        </div>
      </section>

      {/* FORM */}
      <main className="mx-auto w-[min(980px,95vw)] px-4 pb-10">
        <div className="mb-4 rounded-xl border border-white/10 bg-zinc-900/50 p-3 text-sm">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-sky-300" />
            <span>
              Status awal <span className="font-semibold text-sky-300">pending</span>. Konten akan ditinjau moderator sebelum tayang.
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
              {msg.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : msg.type === "error" ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
              <span>{msg.text}</span>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[140px,1fr]">
            <div>
              <label className="mb-1 block text-sm opacity-80">Nomor Bab</label>
              <input
                type="number"
                min={1}
                value={number}
                onChange={(e) => setNumber(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="1"
                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm outline-none ring-1 ring-transparent transition focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm opacity-80">Judul Bab (opsional)</label>
              <input
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder="Contoh: Prolog / Pertemuan Pertama"
                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm outline-none ring-1 ring-transparent transition focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm opacity-80">Konten</label>
            <RichEditor value={contentHTML} onChange={setContentHTML} placeholder="Tulis isi bab di sini…" />
            <div className="mt-1 text-xs text-zinc-400">Konten disimpan sebagai HTML. Gunakan toolbar untuk format dasar.</div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => { setChapterTitle(""); setContentHTML(""); }}
            disabled={submitting}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !novelId}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Mengajukan…</>) : (<><Send className="h-4 w-4" /> Ajukan Bab</>)}
          </button>
        </div>
      </main>

      <BottomBar />
    </div>
  );
}
