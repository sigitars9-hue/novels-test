// app/read/[type]/[id]/page.tsx
import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// (opsional) SEO generik; silakan kustomisasi
export const metadata: Metadata = {
  title: "Reader",
};

type ComicChapter = {
  id: string;
  number: number;
  title: string;
  visibility: "public" | "unlisted" | "private";
  is_published: boolean;
  comic_id: string;
};

type ComicImage = { id: string; url: string; ord: number };

// NOTE: sesuaikan nama tabel NOVEL kamu di 2 blok bertanda !!! TODO NOVEL
type NovelChapter = {
  id: string;
  number: number | null;
  title: string | null;
  visibility: "public" | "unlisted" | "private";
  is_published: boolean;
  novel_id: string | null;
  content?: string | null; // kalau pakai single field
};

type NovelParagraph = { id: string; ord: number; text: string };

export default async function ReaderPage({
  params,
  searchParams,
}: {
  params: { type: "comic" | "novel"; id: string };
  searchParams: { token?: string };
}) {
  const { type, id } = params;
  const token = searchParams?.token ?? null;

  if (type !== "comic" && type !== "novel") {
    return notFound("Tipe tidak dikenal. Gunakan /read/comic/... atau /read/novel/...");
  }

  if (type === "comic") {
    return await renderComic(id, token);
  }

  // type === "novel"
  return await renderNovel(id, token);
}

function notFound(message = "Halaman tidak ditemukan") {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="opacity-70 mt-2">{message}</p>
    </div>
  );
}

/* ------------------------------ COMIC READER ------------------------------ */

async function renderComic(chapterId: string, token: string | null) {
  // 1) coba chapter public
  let { data: chapter } = await supabase
    .from("chapters")
    .select("id, number, title, visibility, is_published, comic_id")
    .eq("id", chapterId)
    .eq("visibility", "public")
    .eq("is_published", true)
    .maybeSingle<ComicChapter>();

  // 2) kalau tidak ketemu & ada token → RPC unlisted (lihat instruksi SQL di bawah)
  if (!chapter && token) {
    const { data } = await supabase.rpc("get_unlisted_chapter", {
      chapter: chapterId,
      in_token: token,
    });
    chapter = (data as ComicChapter) ?? null;
  }

  if (!chapter) {
    return notFound(
      "Chapter komik tidak tersedia (mungkin private/belum publish atau token salah)."
    );
  }

  // 3) ambil images
  let images: ComicImage[] = [];
  if (chapter.visibility === "public" && chapter.is_published) {
    const { data } = await supabase
      .from("images")
      .select("id, url, ord")
      .eq("chapter_id", chapter.id)
      .order("ord", { ascending: true });
    images = (data as ComicImage[]) ?? [];
  } else if (chapter.visibility === "unlisted" && token) {
    const { data } = await supabase.rpc("get_unlisted_images", {
      chapter: chapter.id,
      in_token: token,
    });
    images = (data as ComicImage[]) ?? [];
  }

  const { data: comic } = await supabase
    .from("comics")
    .select("title")
    .eq("id", chapter.comic_id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4">
        <div className="text-sm opacity-70">{comic?.title ?? "—"}</div>
        <h1 className="text-2xl font-bold">
          Chapter {chapter.number} — {chapter.title}
        </h1>
        {chapter.visibility === "unlisted" && (
          <div className="mt-1 text-xs text-amber-400">
            Unlisted — hanya yang memiliki tautan yang dapat melihat.
          </div>
        )}
      </div>

      {!images.length ? (
        <p className="opacity-70">Belum ada gambar.</p>
      ) : (
        <div className="space-y-2">
          {images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.id}
              src={img.url}
              alt={`Page ${img.ord}`}
              className="w-full rounded-lg bg-zinc-900 object-contain"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ NOVEL READER ------------------------------ */

async function renderNovel(chapterId: string, token: string | null) {
  // !!! TODO NOVEL: ganti nama tabel/kolom sesuai skema kamu
  // coba chapter public
  let { data: chapter } = await supabase
    .from("novel_chapters") // <= ganti kalau beda
    .select("id, number, title, visibility, is_published, novel_id, content")
    .eq("id", chapterId)
    .eq("visibility", "public")
    .eq("is_published", true)
    .maybeSingle<NovelChapter>();

  // (opsional) kalau butuh unlisted untuk novel, buat RPC serupa komik:
  // get_unlisted_novel_chapter + get_unlisted_novel_paragraphs, lalu cek token di sini.

  if (!chapter) {
    return notFound(
      "Chapter novel tidak tersedia (mungkin private/belum publish)."
    );
  }

  // ambil paragraf jika kamu menyimpan per-paragraf
  let paragraphs: NovelParagraph[] = [];
  const { data: paras } = await supabase
    .from("novel_paragraphs") // <= ganti kalau beda
    .select("id, ord, text")
    .eq("chapter_id", chapter.id)
    .order("ord", { ascending: true });

  paragraphs = (paras as NovelParagraph[]) ?? [];

  // (fallback) kalau tidak ada paragraf, pakai field content di chapter
  const { data: novel } = await supabase
    .from("novels") // <= ganti kalau beda
    .select("title")
    .eq("id", chapter.novel_id)
    .maybeSingle();

  return (
    <div className="prose prose-invert mx-auto max-w-3xl p-4">
      <div className="mb-4">
        <div className="text-sm opacity-70">{novel?.title ?? "—"}</div>
        <h1 className="mb-1 text-2xl font-bold">
          {chapter.number ? `Chapter ${chapter.number} — ` : ""}
          {chapter.title ?? "Untitled"}
        </h1>
      </div>

      {paragraphs.length > 0 ? (
        <article className="space-y-4 leading-relaxed">
          {paragraphs.map((p) => (
            <p key={p.id}>{p.text}</p>
          ))}
        </article>
      ) : chapter.content ? (
        <article className="whitespace-pre-wrap leading-relaxed">
          {chapter.content}
        </article>
      ) : (
        <p className="opacity-70">Belum ada konten.</p>
      )}
    </div>
  );
}
