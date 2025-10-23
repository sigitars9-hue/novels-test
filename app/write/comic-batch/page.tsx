"use client";

// ====== tambahkan baris2 ini agar tak diprerender & tak cached
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BottomBar from "@/components/BottomBar";
import {
  Loader2, Info, CheckCircle2, AlertTriangle, Images, Hash, BookOpen, Play,
} from "lucide-react";

type Msg = { type: "success" | "error" | "info"; text: string };

function slugify(x: string) {
  return x
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/* ========= Wrapper export default: bungkus pakai Suspense ========= */
export default function ComicBatchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center bg-zinc-950 text-zinc-100">
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-2 text-sm">
            Memuat…
          </div>
        </div>
      }
    >
      <ComicBatchPageInner />
    </Suspense>
  );
}

/* ========= Pindahkan isi komponen ke sini ========= */
function ComicBatchPageInner() {
  const router = useRouter();
  const search = useSearchParams();

  const [userEmail, setUserEmail] = useState<string | null>(null);

  // form
  const [comicTitle, setComicTitle] = useState("");
  const [comicSlug, setComicSlug] = useState(""); // opsional
  const [chapterNumber, setChapterNumber] = useState<number | "">("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [imageLinks, setImageLinks] = useState("");
  const [resultHref, setResultHref] = useState<string | null>(null);

  // ui
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [autoGo, setAutoGo] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  // Prefill slug dari ?slug=
  useEffect(() => {
    const s = search.get("slug");
    if (s) setComicSlug(s);
  }, [search]);

  const lines = useMemo(
    () => imageLinks.split("\n").map((s) => s.trim()).filter(Boolean),
    [imageLinks]
  );
  const validUrls = useMemo(() => lines.filter((s) => /^https?:\/\//i.test(s)), [lines]);
  const invalidCount = lines.length - validUrls.length;

  async function handleSubmit() {
    setMsg(null);
    setResultHref(null);

    if (!comicTitle.trim() && !comicSlug.trim()) {
      setMsg({ type: "error", text: "Isi judul komik atau slug komik." });
      return;
    }
    if (chapterNumber === "" || !Number.isFinite(Number(chapterNumber))) {
      setMsg({ type: "error", text: "Nomor chapter tidak valid." });
      return;
    }
    if (!validUrls.length) {
      setMsg({ type: "error", text: "Masukkan minimal satu URL gambar (http/https), satu per baris." });
      return;
    }

    setSubmitting(true);
    try {
      const { error: rpcErr } = await supabase.rpc("ensure_profile");
      if (rpcErr) throw new Error(rpcErr.message || "Gagal memastikan profil.");

      // 1) comic
      let finalSlug = comicSlug.trim();
      if (!finalSlug && comicTitle.trim()) finalSlug = slugify(comicTitle);
      if (!finalSlug) throw new Error("Slug komik kosong.");

      const { data: existComic, error: exErr } = await supabase
        .from("comics")
        .select("id, slug, title")
        .eq("slug", finalSlug)
        .limit(1)
        .maybeSingle();
      if (exErr) throw new Error(exErr.message);

      let comicId: string | null = existComic?.id ?? null;
      if (!comicId) {
        const { data: newComic, error: addErr } = await supabase
          .from("comics")
          .insert([{ title: comicTitle.trim() || finalSlug, slug: finalSlug }])
          .select("id, slug")
          .single();
        if (addErr) throw new Error(addErr.message);
        comicId = newComic.id;
      }
      if (!comicId) throw new Error("Gagal mendapatkan ID komik.");

      // 2) chapter
      const chNum = Number(chapterNumber);
      const { data: existCh } = await supabase
        .from("chapters")
        .select("id")
        .eq("comic_id", comicId)
        .eq("number", chNum)
        .limit(1)
        .maybeSingle();

      let chapterId: string | null = existCh?.id ?? null;

      if (!chapterId) {
        const { data: ch, error: chErr } = await supabase
          .from("chapters")
          .insert([{ comic_id: comicId, number: chNum, title: chapterTitle || null }])
          .select("id")
          .single();
        if (chErr) throw new Error(chErr.message);
        chapterId = ch.id;
      } else {
        await supabase.from("chapter_images").delete().eq("chapter_id", chapterId);
      }
      if (!chapterId) throw new Error("Gagal mendapatkan ID chapter.");

      // 3) images
      const rows = validUrls.map((url, idx) => ({ chapter_id: chapterId!, page: idx + 1, url }));
      const { error: imgErr } = await supabase.from("chapter_images").insert(rows);
      if (imgErr) throw new Error(imgErr.message);

      const href = `/read/${finalSlug}/${chNum}`;
      setResultHref(href);
      setMsg({ type: "success", text: `Chapter ${chNum} berhasil diposting dengan ${rows.length} halaman.` });

      if (autoGo) setTimeout(() => router.push(href), 250);
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Gagal memposting komik." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* … sisanya TETAP seperti punyamu (UI, preview grid, tombol, dll) … */}
      {/* Pastikan tidak ada perubahan UX selain Suspense wrapper & export dynamic di atas */}
    </div>
  );
}
