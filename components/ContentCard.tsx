"use client";

import Link from "next/link";
import clsx from "clsx";

/* ---------- Types ---------- */
export type ContentCardItem = {
  id: string | number;
  slug: string;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  tags?: string[] | null;              // genre list
  created_at?: string | null;
  updated_at?: string | null;
};

/* ---------- Utils ---------- */
function timeAgoShort(dt?: string | null) {
  if (!dt) return "";
  const ms = Date.now() - new Date(dt).getTime();
  const s = Math.max(1, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  const y = Math.floor(mo / 12);
  return `${y}y`;
}
function initial(t?: string | null) {
  const s = (t || "N").trim();
  return (s[0] || "N").toUpperCase();
}

/* warna genre ringan (pastel) */
const TAG_COLORS: Record<string, string> = {
  action:
    "bg-red-500/15 text-red-200 ring-1 ring-red-400/40",
  adventure:
    "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/40",
  fantasy:
    "bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/40",
  romance:
    "bg-pink-500/15 text-pink-200 ring-1 ring-pink-400/40",
  "sci-fi":
    "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/40",
  mystery:
    "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40",
};

/* ---------- Component ---------- */
export default function ContentCard({ item }: { item: ContentCardItem }) {
  const {
    slug,
    title,
    description,
    cover_url,
    tags = [],
    created_at,
    updated_at,
  } = item;

  const when = timeAgoShort(updated_at || created_at || null);

  // pick 1–2 genre teratas
  const genres = Array.isArray(tags) ? tags.slice(0, 2) : [];

  return (
    <Link
      href={`/novel/${slug}` as any}
      className="group block overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40"
    >
      <div className="relative aspect-[3/4] w-full">
        {/* COVER */}
        {cover_url ? (
          <img
            src={cover_url}
            alt={title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-sky-300 to-blue-600 text-6xl font-extrabold text-white/90">
            {initial(title)}
          </div>
        )}

        {/* SHADOW TOP & BOTTOM */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black/55 via-black/25 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/75 via-black/40 to-transparent" />

        {/* BADGE WAKTU – kiri atas */}
        {!!when && (
          <div className="absolute left-2 top-2 z-10 rounded-full bg-white/15 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur ring-1 ring-white/20">
            {when} ago
          </div>
        )}

        {/* TEXT OVERLAY BAWAH */}
        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          {/* genre chips */}
          {!!genres.length && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {genres.map((g, i) => {
                const key = g.toLowerCase();
                const color = TAG_COLORS[key] || "bg-white/15 text-white ring-1 ring-white/25";
                return (
                  <span
                    key={i}
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      color
                    )}
                  >
                    {g}
                  </span>
                );
              })}
            </div>
          )}

          {/* judul */}
          <h3 className="line-clamp-2 text-lg font-extrabold leading-tight">
            {title}
          </h3>

          {/* sinopsis */}
          {description && (
            <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-zinc-200/95">
              {description}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
