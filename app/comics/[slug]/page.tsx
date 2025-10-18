// app/comics/[slug]/page.tsx
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function ComicDetailPage({
  params,
}: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);

  // 1) Ambil komik by slug (hanya yang published ditampilkan publik)
  const { data: comic, error: comicErr } = await supabase
    .from("comics")
    .select("id, title, slug, description, cover_url, status")
    .eq("slug", slug)
    .single();

  if (comicErr || !comic) {
    // slug tidak ditemukan
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">Komik tidak ditemukan</h1>
        <p className="opacity-70">Periksa kembali slug: <code>{slug}</code></p>
      </div>
    );
  }

  // 2) Ambil chapters publik & published
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, number, title")
    .eq("comic_id", comic.id)
    .eq("visibility", "public")
    .eq("is_published", true)
    .order("number", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex gap-4">
        {comic.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comic.cover_url}
            alt={comic.title}
            className="h-40 w-28 rounded-lg object-cover"
          />
        )}
        <div>
          <h1 className="text-3xl font-bold">{comic.title}</h1>
          {comic.description && (
            <p className="mt-2 whitespace-pre-line opacity-80">
              {comic.description}
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold">Chapters</h2>
        {!chapters?.length ? (
          <p className="opacity-70">Belum ada chapter public yang dipublish.</p>
        ) : (
          <ul className="space-y-2">
            {chapters.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg bg-zinc-900/50 p-3">
                <div>
                  <div className="text-sm opacity-70">Chapter {c.number}</div>
                  <div className="font-medium">{c.title}</div>
                </div>
                <Link
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-500"
                  href={`/read/${c.id}`}
                >
                  Baca
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
