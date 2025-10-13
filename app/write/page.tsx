"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import BottomBar from "@/components/BottomBar";
import Link from "next/link";
import {
  Loader2,
  Info,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  Upload,
} from "lucide-react";

const GENRES = [
  "Fantasy",
  "Sci-Fi",
  "Romance",
  "Adventure",
  "Mystery",
  "Horror",
  "Drama",
  "Slice of Life",
] as const;

type Msg = { type: "success" | "error" | "info"; text: string };

export default function WriteMetaPage() {
  // form
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [coverUrl, setCoverUrl] = useState(""); // kalau pakai URL manual
  const [coverFile, setCoverFile] = useState<File | null>(null);

  // ui
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [novelId, setNovelId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  function toggleGenre(g: string) {
    setTags((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  }

  async function uploadCoverIfNeeded() {
    if (!coverFile) return coverUrl.trim() || null;
    // pastikan user
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error("Harus login.");

    const ext = coverFile.name.split(".").pop() || "jpg";
    const path = `public/${uid}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("covers")
      .upload(path, coverFile, {
        contentType: coverFile.type || "image/jpeg",
        upsert: false,
      });
    if (upErr) throw new Error(upErr.message);

    const { data: pub } = supabase.storage.from("covers").getPublicUrl(path);
    return pub?.publicUrl || null;
  }

  function resetForm() {
    setTitle("");
    setSynopsis("");
    setTags([]);
    setCoverUrl("");
    setCoverFile(null);
    setNovelId(null);
  }

  async function handleSubmit() {
    setMsg(null);

    // validasi ringan
    if (!title.trim()) {
      setMsg({ type: "error", text: "Judul wajib diisi." });
      return;
    }
    if (synopsis.trim().length < 10) {
      setMsg({ type: "error", text: "Sinopsis terlalu pendek (min. ±10 karakter)." });
      return;
    }
    if (!tags.length) {
      setMsg({ type: "error", text: "Pilih minimal satu genre." });
      return;
    }

    setSubmitting(true);
    try {
      // pastikan profile ada
      const { error: rpcErr } = await supabase.rpc("ensure_profile");
      if (rpcErr) throw new Error(rpcErr.message || "Gagal memastikan profil.");

      // upload cover (jika ada file)
      const finalCover = await uploadCoverIfNeeded();

      // panggil RPC untuk CREATE novel (p_novel_id = null)
      const { data, error } = await supabase.rpc("save_novel_meta", {
        p_novel_id: null,
        p_title: title.trim(),
        p_synopsis: synopsis.trim(),
        p_cover: finalCover,
        p_tags: tags,
        p_slug_hint: title.trim(),
      });

      if (error) throw new Error(error.message);

      setNovelId(data as string);
      setMsg({
        type: "success",
        text: "Metadata novel tersimpan. Kamu bisa lanjut membuat Bab.",
      });
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Gagal menyimpan metadata." });
    } finally {
      setSubmitting(false);
    }
  }

  const canProceedToChapters = useMemo(() => !!novelId, [novelId]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* HERO */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_20%_-10%,rgba(125,211,252,.12),transparent),radial-gradient(700px_320px_at_80%_0%,rgba(147,197,253,.12),transparent)]" />
        <div className="mx-auto w-[min(980px,95vw)] px-4 py-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Publikasi Metadata Novel</h1>
          <p className="mt-1 text-sm text-zinc-300/90">
            Lengkapi judul, genre, sinopsis, dan cover.{" "}
            {userEmail ? `Masuk sebagai ${userEmail}.` : ""}
          </p>
        </div>
      </section>

      {/* FORM */}
      <main className="mx-auto w-[min(980px,95vw)] px-4 pb-10">
        <div className="mb-4 rounded-xl border border-white/10 bg-zinc-900/50 p-3 text-sm">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-sky-300" />
            <span>
              Halaman ini <b>hanya</b> untuk metadata. Bab dibuat di halaman{" "}
              <code className="rounded bg-white/10 px-1">Write &gt; New</code> dan{" "}
              <b>wajib di-approve admin</b>.
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
            {canProceedToChapters && (
              <div className="mt-3">
                <Link
                  href={`/write/new?novel_id=${novelId}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  Lanjut buat Bab
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-5">
          {/* Judul */}
          <div>
            <label className="mb-1 block text-sm opacity-80">Judul</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul novel"
              className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 outline-none ring-1 ring-transparent transition focus:ring-sky-500"
            />
          </div>

          {/* Genre */}
          <div>
            <label className="mb-1 block text-sm opacity-80">Genre</label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => {
                const active = tags.includes(g);
                return (
                  <button
                    type="button"
                    key={g}
                    onClick={() => toggleGenre(g)}
                    className={[
                      "rounded-full border px-3 py-1.5 text-sm transition",
                      active
                        ? "border-sky-500 bg-sky-600 text-white shadow-[0_0_0_6px_rgba(56,189,248,0.15)]"
                        : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
                    ].join(" ")}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              Kamu bisa memilih lebih dari satu genre.
            </div>
          </div>

          {/* Sinopsis */}
          <div>
            <label className="mb-1 block text-sm opacity-80">Sinopsis</label>
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Ringkasan cerita / hook pembuka..."
              rows={5}
              className="w-full resize-y rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 outline-none ring-1 ring-transparent transition focus:ring-sky-500"
            />
          </div>

          {/* Cover */}
          <div>
            <label className="mb-1 block text-sm opacity-80">Cover</label>
            <div className="grid gap-3 sm:grid-cols-[1fr,260px]">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 opacity-70" />
                  <span className="text-sm opacity-80">Unggah file (opsional)</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-white/10 file:bg-white/5 file:px-3 file:py-1.5 file:text-sm hover:file:bg-white/10"
                />
                <div className="text-xs text-zinc-400">
                  Jika kamu unggah file, kolom URL di kanan akan diabaikan.
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 opacity-70" />
                  <span className="text-sm opacity-80">Atau gunakan URL gambar</span>
                </div>
                <input
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm outline-none ring-1 ring-transparent transition focus:ring-sky-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={resetForm}
            disabled={submitting}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
          >
            Reset
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan…
              </>
            ) : (
              <>Simpan Metadata</>
            )}
          </button>
        </div>
      </main>

      <BottomBar />
    </div>
  );
}
