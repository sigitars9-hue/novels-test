"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";

/** ---------- Props / Types ---------- */
export type ContentCardItem = {
  id: string | number;
  slug: string;
  title: string;

  cover_url?: string | null;

  // teks
  synopsis?: string | null;     // prefer ini
  description?: string | null;  // fallback bila caller masih pakai "description"

  // meta
  tags?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;

  // badge opsional
  up?: boolean | null;
  flag_url?: string | null;     // contoh: "/flags/kr.svg"
};

/** ---------- Utils ---------- */
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

/** ---------- Component ---------- */
export default function ContentCard({ item }: { item: ContentCardItem }) {
  if (!item) return null;

  const {
    slug,
    title,
    cover_url,
    tags = [],
    created_at,
    updated_at,
    up,
    flag_url,
  } = item;

  // sinkronisasi synopsis vs description
  const synopsis: string | null =
    item.synopsis ?? item.description ?? null;

  const when = timeAgoShort(updated_at || created_at || null);
  const genre = Array.isArray(tags) && tags.length ? tags[0] : null;

  const isRecent =
    typeof up === "boolean"
      ? up
      : updated_at
      ? (Date.now() - new Date(updated_at).getTime()) / 36e5 <= 24
      : false;

  // interaksi hover/tap/focus → munculin overlay
  const [show, setShow] = useState(false);
  const onEnter = () => setShow(true);
  const onLeave = () => setShow(false);
  const onTouchStart = () => setShow(true);
  const onTouchEnd = () => setTimeout(() => setShow(false), 400);

  return (
    <Link
      href={`/novel/${slug}`}
      className="group block"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className={clsx(
          "relative overflow-hidden",
          "aspect-[2/3] rounded-xl md:rounded-[14px]",
          "border border-white/10 bg-zinc-900/40 transition hover:border-white/15"
        )}
      >
        {/* COVER */}
        {cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover_url}
            alt={title}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-full w-full bg-zinc-800" />
        )}

        {/* BADGES kiri-atas */}
        {(when || isRecent) && (
          <div className="absolute left-2 top-2 z-20 flex items-center gap-1">
            {when && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-zinc-900 shadow">
                <span className="inline-block h-[8px] w-[8px] rounded-full bg-violet-600" />
                {when}
              </span>
            )}
            {isRecent && (
              <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                U
              </span>
            )}
          </div>
        )}

        {/* BADGE bendera kanan-atas (opsional) */}
        {flag_url && (
          <div className="absolute right-2 top-2 z-20">
            <span className="inline-flex items-center justify-center rounded-md bg-white/95 p-1 shadow">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={flag_url} alt="flag" className="h-4 w-6 object-cover" />
            </span>
          </div>
        )}

        {/* OVERLAY: gradient + judul + genre + waktu + sinopsis */}
        <div
          className={clsx(
            "absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end",
            "bg-gradient-to-t from-black/90 via-black/60 to-transparent",
            "p-3 text-white",
            "transition-opacity duration-500",
            show ? "opacity-100" : "opacity-0"
          )}
        >
          <h3 className="line-clamp-2 text-[14px] font-bold leading-snug drop-shadow sm:text-[15px]">
            {title}
          </h3>

          <div className="mt-1 flex items-center gap-2 text-[11px]">
            {genre && (
              <span className="rounded-md bg-sky-500/20 px-2 py-[2px] text-sky-300">
                {genre}
              </span>
            )}
            {when && <span className="text-zinc-300">{when} ago</span>}
          </div>

          {synopsis && (
            <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-zinc-200/90 drop-shadow-sm">
              {synopsis}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
