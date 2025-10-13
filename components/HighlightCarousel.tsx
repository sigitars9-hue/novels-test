"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import clsx from "clsx";

export type HighlightItem = {
  id: string;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  genre?: string | null;
  rating?: number | null;
};

export default function HighlightCarousel({
  items,
  auto = true,
  interval = 5000,
  compact = false, // ⟵ baru
  className, 
}: {
  items: HighlightItem[];
  auto?: boolean;
  interval?: number;
  compact?: boolean;
  className?: string;  
}) {
  const [idx, setIdx] = useState(0);
  const total = items.length;

  useEffect(() => {
    if (!auto || total <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % total), interval);
    return () => clearInterval(t);
  }, [auto, interval, total]);

  const current = useMemo(() => items[idx], [items, idx]);

  const goto = (i: number) => {
    if (total === 0) return;
    if (i < 0) i = total - 1;
    if (i >= total) i = 0;
    setIdx(i);
  };

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40",
        compact && "rounded-2xl" // sedikit lebih kecil radius
      )}
    >
      {/* 2 kolom di desktop, stack di mobile */}
      <div className={clsx("grid grid-cols-1 md:grid-cols-[55%_45%]")}>
        {/* text */}
        <div className={clsx("relative", compact ? "px-5 py-5 md:px-6 md:py-6" : "px-6 py-6 md:px-8 md:py-8")}>
          <h2 className={clsx(
            "font-extrabold tracking-tight",
            compact ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl"
          )}>
            {current?.title ?? "—"}
          </h2>

          <div className={clsx("mt-3 flex items-center gap-3", !compact && "mt-4")}>
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 text-sm font-semibold text-amber-300 ring-1 ring-amber-400/40">
              <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
              {current?.rating != null ? current.rating.toFixed(1) : "—"}
            </span>
            {current?.genre && (
              <span className="rounded-md bg-sky-500/15 px-2 py-1 text-sm font-semibold text-sky-300 ring-1 ring-sky-400/40">
                {current.genre}
              </span>
            )}
          </div>

          {current?.description && (
            <p className={clsx(
              "mt-3 text-zinc-200/95",
              compact ? "text-sm leading-relaxed line-clamp-3 md:line-clamp-3"
                      : "text-lg leading-relaxed line-clamp-3 md:line-clamp-4"
            )}>
              {current.description}
            </p>
          )}

          {/* controls */}
          {total > 1 && (
            <div className={clsx("flex items-center gap-3", compact ? "mt-4" : "mt-6")}>
              <button
                onClick={() => goto(idx - 1)}
                className={clsx(
                  "inline-flex items-center justify-center rounded-xl bg-zinc-900/80 ring-1 ring-white/10 hover:bg-zinc-800",
                  compact ? "h-8 w-8" : "h-9 w-9"
                )}
                aria-label="Sebelumnya"
              >
                <ChevronLeft className={clsx(compact ? "h-4 w-4" : "h-5 w-5")} />
              </button>
              <div className="flex items-center gap-2">
                {items.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goto(i)}
                    className={clsx(
                      "rounded-full ring-1 ring-white/10",
                      compact ? "h-2.5 w-2.5" : "h-3 w-3",
                      i === idx ? "bg-white" : "bg-white/20 hover:bg-white/40"
                    )}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
              <button
                onClick={() => goto(idx + 1)}
                className={clsx(
                  "inline-flex items-center justify-center rounded-xl bg-zinc-900/80 ring-1 ring-white/10 hover:bg-zinc-800",
                  compact ? "h-8 w-8" : "h-9 w-9"
                )}
                aria-label="Berikutnya"
              >
                <ChevronRight className={clsx(compact ? "h-4 w-4" : "h-5 w-5")} />
              </button>
            </div>
          )}
        </div>

        {/* image – SELALU 16:9 */}
        <div className="relative md:block">
          {/* container beraspek 16:9; lebih pendek saat compact */}
          <div
            className={clsx(
              "relative aspect-[16/9] overflow-hidden md:rounded-r-3xl",
              compact ? "min-h-[170px]" : "min-h-[220px]"
            )}
          >
            {/* overlay lembut */}
            <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(70%_80%_at_70%_50%,transparent_60%,rgba(0,0,0,.45))]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />

            {/* gambar / fallback */}
            {current?.cover_url ? (
              <img
                src={current.cover_url}
                alt={current.title}
                className="absolute inset-0 h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-sky-300 to-blue-600" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
