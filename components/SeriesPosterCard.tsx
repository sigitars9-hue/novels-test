"use client";

import Link from "next/link";
import clsx from "clsx";

export type SeriesPoster = {
  id: string | number;
  slug: string;
  title: string;
  cover_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  flag_url?: string | null;
  up?: boolean | null;
  chapters?: Array<{ label: string; time: string; href?: string }>;
};

function isRecent(updated_at?: string | null) {
  if (!updated_at) return false;
  const hours = (Date.now() - new Date(updated_at).getTime()) / 36e5;
  return hours <= 24;
}

export default function SeriesPosterCard({ item }: { item: SeriesPoster }) {
  const {
    slug,
    title,
    cover_url,
    updated_at,
    flag_url,
    up,
    chapters = [],
  } = item;

  const recent = (typeof up === "boolean" ? up : isRecent(updated_at)) || false;

  return (
    <div className="grid grid-rows-[auto_auto_auto] gap-2">
      {/* Poster */}
      <Link
        href={`/novel/${slug}`}
        className={clsx(
          "relative block overflow-hidden rounded-[12px] border border-white/10",
          "bg-zinc-900/40 shadow-sm transition hover:border-white/15"
        )}
      >
        <div className="aspect-[3/4] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              cover_url ||
              "data:image/svg+xml;utf8," +
                encodeURIComponent(
                  `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='800'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0' stop-color='#64748b'/><stop offset='1' stop-color='#0f172a'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#g)'/></svg>`
                )
            }
            alt={title}
            className="h-full w-full object-cover transition duration-400 group-hover:scale-[1.01]"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* badge kiri-atas */}
        {recent && (
          <div className="absolute left-2 top-2 z-10">
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
              UP
            </span>
          </div>
        )}

        {/* flag kanan-bawah */}
        {flag_url && (
          <div className="absolute bottom-2 right-2 z-10 rounded-md bg-white/95 p-1 shadow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={flag_url} alt="flag" className="h-4 w-6 object-cover" />
          </div>
        )}
      </Link>

      {/* Judul: semibold & rata tengah, tinggi konsisten */}
      <Link href={`/novel/${slug}`} className="block">
        <h3
          className={clsx(
            "line-clamp-2 text-center font-semibold leading-snug text-white",
            "text-[15px] md:text-[16px]",
            "min-h-[44px]" // 2 baris ≈ sejajar
          )}
          title={title}
        >
          {title}
        </h3>
      </Link>

      {/* Dua chip chapter — tinggi konsisten */}
      <div className="space-y-2">
        {chapters.slice(0, 2).map((c, i) => {
          const Comp = c.href ? Link : "div";
          const props = c.href ? ({ href: c.href } as any) : {};
          return (
            <Comp
              key={i}
              {...props}
              className={clsx(
                "flex items-center justify-between rounded-[12px] border border-white/10 bg-zinc-800 px-3 py-2.5",
                "text-[14px] text-white transition hover:bg-zinc-750/90",
                "min-h-[44px]"
              )}
            >
              <span className="font-medium">{c.label}</span>
              <span className="text-[13px] text-zinc-300">{c.time}</span>
            </Comp>
          );
        })}
      </div>
    </div>
  );
}
