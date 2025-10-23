"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import BottomBar from "@/components/BottomBar";
import {
  Loader2,
  Info,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  Upload,
  BookOpen,
  Image as ImagesIcon,
} from "lucide-react";

/* ---------------- common ---------------- */
type Msg = { type: "success" | "error" | "info"; text: string };
type Mode = "novel" | "comic";
const GENRES = ["Fantasy","Sci-Fi","Romance","Adventure","Mystery","Horror","Drama","Slice of Life"] as const;

function slugify(x: string) {
  return x.toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function WritePage() {
  const [mode, setMode] = useState<Mode>("novel");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null)); }, []);

  /* ---------------- NOVEL states ---------------- */
  const [nTitle, setNTitle] = useState("");
  const [nSynopsis, setNSynopsis] = useState("");
  const [nTags, setNTags] = useState<string[]>([]);
  const [nCoverUrl, setNCoverUrl] = useState("");
  const [nCoverFile, setNCoverFile] = useState<File | null>(null);
  const [nSubmitting, setNSubmitting] = useState(false);
  const [nMsg, setNMsg] = useState<Msg | null>(null);
  const [novelId, setNovelId] = useState<string | null>(null);
  function toggleGenre(g: string) {
    setNTags((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }
  async function uploadCoverIfNeeded_N(): Promise<string | null> {
    if (!nCoverFile) return nCoverUrl.trim() || null;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id; if (!uid) throw new Error("Harus login.");
    const ext = nCoverFile.name.split(".").pop() || "jpg";
    const path = `public/${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("covers").upload(path, nCoverFile, {
      contentType: nCoverFile.type || "image/jpeg",
      upsert: false,
    });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabase.storage.from("covers").getPublicUrl(path);
    return pub?.publicUrl || null;
  }
  function resetNovelForm() {
    setNTitle(""); setNSynopsis(""); setNTags([]); setNCoverUrl(""); setNCoverFile(null); setNovelId(null); setNMsg(null);
  }
  async function handleSubmitNovel() {
    setNMsg(null);
    if (!nTitle.trim()) return setNMsg({ type: "error", text: "Judul wajib diisi." });
    if (nSynopsis.trim().length < 10) return setNMsg({ type: "error", text: "Sinopsis terlalu pendek (min. ±10 karakter)." });
    if (!nTags.length) return setNMsg({ type: "error", text: "Pilih minimal satu genre." });

    setNSubmitting(true);
    try {
      const { error: rpcErr } = await supabase.rpc("ensure_profile");
      if (rpcErr) throw new Error(rpcErr.message || "Gagal memastikan profil.");
      const finalCover = await uploadCoverIfNeeded_N();
      const { data, error } = await supabase.rpc("save_novel_meta", {
        p_novel_id: null,
        p_title: nTitle.trim(),
        p_synopsis: nSynopsis.trim(),
        p_cover: finalCover,
        p_tags: nTags,
        p_slug_hint: nTitle.trim(),
      });
      if (error) throw new Error(error.message);
      setNovelId(data as string);
      setNMsg({ type: "success", text: "Metadata novel tersimpan. Kamu bisa lanjut membuat Bab." });
    } catch (e: any) {
      setNMsg({ type: "error", text: e?.message || "Gagal menyimpan metadata." });
    } finally {
      setNSubmitting(false);
    }
  }
  const canProceedNovel = useMemo(() => !!novelId, [novelId]);

  /* ---------------- COMIC states ---------------- */
  const [cTitle, setCTitle] = useState("");
  const [cSlug, setCSlug] = useState("");
  const [cCoverUrl, setCCoverUrl] = useState("");
  const [cCoverFile, setCCoverFile] = useState<File | null>(null);
  const [cSubmitting, setCSubmitting] = useState(false);
  const [cMsg, setCMsg] = useState<Msg | null>(null);
  const [comicSlugSaved, setComicSlugSaved] = useState<string | null>(null);

  async function uploadCoverIfNeeded_C(): Promise<string | null> {
    if (!cCoverFile) return cCoverUrl.trim() || null;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id; if (!uid) throw new Error("Harus login.");
    const ext = cCoverFile.name.split(".").pop() || "jpg";
    const path = `public/${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("covers").upload(path, cCoverFile, {
      contentType: cCoverFile.type || "image/jpeg",
      upsert: false,
    });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabase.storage.from("covers").getPublicUrl(path);
    return pub?.publicUrl || null;
  }

  function resetComicForm() {
    setCTitle(""); setCSlug(""); setCCoverUrl(""); setCCoverFile(null); setComicSlugSaved(null); setCMsg(null);
  }

  async function handleSubmitComic() {
    setCMsg(null);
    let finalSlug = cSlug.trim();
    if (!finalSlug && cTitle.trim()) finalSlug = slugify(cTitle);
    if (!finalSlug) return setCMsg({ type: "error", text: "Slug atau Judul komik wajib diisi." });

    setCSubmitting(true);
    try {
      const { error: rpcErr } = await supabase.rpc("ensure_profile");
      if (rpcErr) throw new Error(rpcErr.message || "Gagal memastikan profil.");

      const finalCover = await uploadCoverIfNeeded_C();

      // cek ada/buat
      const { data: exist, error: exErr } = await supabase
        .from("comics")
        .select("id, slug")
        .eq("slug", finalSlug)
        .limit(1)
        .maybeSingle();
      if (exErr) throw new Error(exErr.message);

      if (!exist) {
        const { error: insErr } = await supabase.from("comics").insert([{
          title: cTitle.trim() || finalSlug,
          slug: finalSlug,
          cover_url: finalCover ?? null,
        }]);
        if (insErr) throw new Error(insErr.message);
      } else if (finalCover) {
        // update cover bila user mengupload
        const { error: upErr } = await supabase.from("comics").update({ cover_url: finalCover }).eq("id", exist.id);
        if (upErr) throw new Error(upErr.message);
      }

      setComicSlugSaved(finalSlug);
      setCMsg({ type: "success", text: "Metadata komik tersimpan. Lanjut posting halaman komik." });
    } catch (e: any) {
      setCMsg({ type: "error", text: e?.message || "Gagal menyimpan metadata komik." });
    } finally {
      setCSubmitting(false);
    }
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* HERO */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_20%_-10%,rgba(125,211,252,.12),transparent),radial-gradient(700px_320px_at_80%_0%,rgba(147,197,253,.12),transparent)]" />
        <div className="mx-auto w-[min(980px,95vw)] px-4 py-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Tulis Karya</h1>
          <p className="mt-1 text-sm text-zinc-300/90">
            Pilih jenis karya, lalu isi metadata (cover, judul, dst). {userEmail ? `Masuk sebagai ${userEmail}.` : ""}
          </p>

          {/* Switch Novel/Komik */}
          <div className="mt-4 inline-flex items-center rounded-2xl border border-white/10 bg-zinc-900/60 p-1">
            <button
              onClick={() => setMode("novel")}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm ${
                mode === "novel" ? "bg-sky-600 text-white" : "hover:bg-white/10"
              }`}
            >
              <BookOpen className="h-4 w-4" /> Novel
            </button>
            <button
              onClick={() => setMode("comic")}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm ${
                mode === "comic" ? "bg-fuchsia-600 text-white" : "hover:bg-white/10"
              }`}
            >
              <ImagesIcon className="h-4 w-4" /> Komik
            </button>
          </div>
        </div>
      </section>

      {/* BODY */}
      <main className="mx-auto w-[min(980px,95vw)] px-4 pb-10">
        {mode === "novel" ? (
          <>
            <div className="mb-4 rounded-xl border border-white/10 bg-zinc-900/50 p-3 text-sm">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-sky-300" />
                <span>
                  Halaman ini <b>hanya</b> untuk metadata novel. Bab dibuat di{" "}
                  <code className="rounded bg-white/10 px-1">Write &gt; New</code> dan <b>wajib di-approve admin</b>.
                </span>
              </div>
              <div className="mt-3">
                <Link
                  href="/write/comic-batch"
                  className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-fuchsia-700"
                >
                  Atau posting Komik (Batch Link)
                </Link>
              </div>
            </div>

            {nMsg && (
              <AlertBox msg={nMsg}>
                {canProceedNovel && (
                  <Link
                    href={`/write/new?novel_id=${novelId}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    Lanjut buat Bab
                  </Link>
                )}
              </AlertBox>
            )}

            {/* Form NOVEL */}
            <div className="grid gap-5">
              <div>
                <label className="mb-1 block text-sm opacity-80">Judul</label>
                <input
                  value={nTitle} onChange={(e) => setNTitle(e.target.value)}
                  placeholder="Judul novel"
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 outline-none ring-1 ring-transparent transition focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm opacity-80">Genre</label>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((g) => {
                    const active = nTags.includes(g);
                    return (
                      <button
                        type="button" key={g} onClick={() => toggleGenre(g)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${
                          active
                            ? "border-sky-500 bg-sky-600 text-white shadow-[0_0_0_6px_rgba(56,189,248,0.15)]"
                            : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1 text-xs text-zinc-400">Kamu bisa memilih lebih dari satu genre.</div>
              </div>

              <div>
                <label className="mb-1 block text-sm opacity-80">Sinopsis</label>
                <textarea
                  value={nSynopsis} onChange={(e) => setNSynopsis(e.target.value)}
                  placeholder="Ringkasan cerita / hook pembuka..."
                  rows={5}
                  className="w-full resize-y rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 outline-none ring-1 ring-transparent transition focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm opacity-80">Cover</label>
                <div className="grid gap-3 sm:grid-cols-[1fr,260px]">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 opacity-70" />
                      <span className="text-sm opacity-80">Unggah file (opsional)</span>
                    </div>
                    <input
                      type="file" accept="image/*"
                      onChange={(e) => setNCoverFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-white/10 file:bg-white/5 file:px-3 file:py-1.5 file:text-sm hover:file:bg-white/10"
                    />
                    <div className="text-xs text-zinc-400">Jika kamu unggah file, kolom URL di kanan akan diabaikan.</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 opacity-70" />
                      <span className="text-sm opacity-80">Atau gunakan URL gambar</span>
                    </div>
                    <input
                      value={nCoverUrl} onChange={(e) => setNCoverUrl(e.target.value)}
                      placeholder="https://…"
                      className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm outline-none ring-1 ring-transparent transition focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={resetNovelForm} disabled={nSubmitting}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-60">
                Reset
              </button>
              <button onClick={handleSubmitNovel} disabled={nSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
                {nSubmitting ? (<><Loader2 className="h-4 w-4 animate-spin" />Menyimpan…</>) : (<>Simpan Metadata</>)}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 rounded-xl border border-white/10 bg-zinc-900/50 p-3 text-sm">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-fuchsia-300" />
                <span>
                  Ini metadata komik (judul, slug, cover). Setelah tersimpan, lanjutkan ke{" "}
                  <b>Posting Komik (Batch Link)</b> untuk memasukkan halaman.
                </span>
              </div>
            </div>

            {cMsg && (
              <AlertBox msg={cMsg}>
                {comicSlugSaved && (
                  <Link
                    href={`/write/comic-batch?slug=${encodeURIComponent(comicSlugSaved)}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-fuchsia-700"
                  >
                    Lanjut posting halaman
                  </Link>
                )}
              </AlertBox>
            )}

            {/* Form KOMIK */}
            <div className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm opacity-80">Judul Komik</label>
                  <input
                    value={cTitle} onChange={(e) => setCTitle(e.target.value)}
                    placeholder="Judul komik"
                    className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 outline-none ring-1 ring-transparent transition focus:ring-fuchsia-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm opacity-80">Slug Komik (opsional)</label>
                  <input
                    value={cSlug} onChange={(e) => setCSlug(e.target.value)}
                    placeholder="contoh: one-piece"
                    className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 outline-none ring-1 ring-transparent transition focus:ring-fuchsia-500"
                  />
                  <div className="mt-1 text-xs text-zinc-400">Jika kosong, slug dibuat dari judul.</div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm opacity-80">Cover Komik</label>
                <div className="grid gap-3 sm:grid-cols-[1fr,260px]">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 opacity-70" />
                      <span className="text-sm opacity-80">Unggah file (opsional)</span>
                    </div>
                    <input
                      type="file" accept="image/*"
                      onChange={(e) => setCCoverFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-white/10 file:bg-white/5 file:px-3 file:py-1.5 file:text-sm hover:file:bg-white/10"
                    />
                    <div className="text-xs text-zinc-400">Jika unggah file, kolom URL di kanan diabaikan.</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 opacity-70" />
                      <span className="text-sm opacity-80">Atau gunakan URL gambar</span>
                    </div>
                    <input
                      value={cCoverUrl} onChange={(e) => setCCoverUrl(e.target.value)}
                      placeholder="https://…"
                      className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm outline-none ring-1 ring-transparent transition focus:ring-fuchsia-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={resetComicForm} disabled={cSubmitting}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-60">
                Reset
              </button>
              <button onClick={handleSubmitComic} disabled={cSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-60">
                {cSubmitting ? (<><Loader2 className="h-4 w-4 animate-spin" />Menyimpan…</>) : (<>Simpan Metadata</>)}
              </button>
            </div>
          </>
        )}
      </main>

      <BottomBar />
    </div>
  );
}

/* -------- small helper component for alert w/ slot -------- */
function AlertBox({ msg, children }: { msg: Msg; children?: React.ReactNode }) {
  return (
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
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
