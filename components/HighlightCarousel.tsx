"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Star, ArrowRight } from "lucide-react";

export type HighlightItem = {
  id: string | number;
  title: string;
  slug?: string;
  href?: string | null;
  description?: string | null;
  cover_url?: string | null;
  genre?: string | null;
  rating?: number | null;
};

type Props = {
  items: HighlightItem[];
  auto?: boolean;
  interval?: number;
  compact?: boolean;
  className?: string;
  basePath?: string;
  getHref?: (item: HighlightItem) => string;
  fill?: boolean;
  height?: string;          // ← ADD THIS
};


export default function HighlightCarousel({
  items,
  auto = true,
  interval = 5000,
  compact = false,
  className,
  basePath = "/novel",
  getHref,
}: Props) {
  const [idx, setIdx] = useState(0);
  const total = items.length;
  const router = useRouter();

  // auto-rotate
  useEffect(() => {
    if (!auto || total <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % total), interval);
    return () => clearInterval(t);
  }, [auto, interval, total]);

  const current = useMemo(() => items[idx], [items, idx]);

  function joinPath(a: string, b: string) {
    return `${a.replace(/\/$/, "")}/${(b || "").replace(/^\//, "")}`;
  }

  function resolveHref(it?: HighlightItem) {
    if (!it) return "";
    if (typeof getHref === "function") return getHref(it);
    if (it.href) return it.href;
    if (it.slug) return joinPath(basePath, it.slug);
    return joinPath(basePath, String(it.id));
  }

  function goto(i: number) {
    if (!total) return;
    if (i < 0) i = total - 1;
    if (i >= total) i = 0;
    setIdx(i);
  }

  function handleNavigate() {
    const href = resolveHref(current);
    if (href) router.push(href);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleNavigate();
    }
    if (e.key === "ArrowLeft") goto(idx - 1);
    if (e.key === "ArrowRight") goto(idx + 1);
  }

  return (
    <div
      className={["relative", className || ""].join(" ").trim()}
      role="region"
      aria-roledescription="carousel"
      aria-label="Sorotan"
    >
      {/* Slide card */}
      <div
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={handleNavigate}
        aria-label={current?.title ? `Buka ${current.title}` : "Buka"}
        className={[
          "relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40",
          "shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)]",
          compact ? "h-[220px]" : "h-[300px] md:h-[360px] lg:h-[400px]",
        ].join(" ")}
        style={{ cursor: resolveHref(current) ? "pointer" : "default" }}
      >
        {/* Background image */}
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

        {/* Overlays */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_100%_at_20%_40%,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.55)_45%,rgba(0,0,0,0.15)_70%,transparent_85%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Content */}
        <div className="relative z-10 h-full">
          {/* Badge kiri-atas */}
          <div className="px-5 pt-5 md:px-7 md:pt-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold backdrop-blur-md ring-1 ring-white/20">
              <span className="text-sky-200">{current?.genre ? current.genre : "Featured"}</span>
              {current?.rating != null && (
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                  {current.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>

          {/* Title + desc */}
          <div className="px-5 md:px-7 mt-3 md:mt-4 max-w-[780px]">
            <h2
              className={[
                "font-extrabold tracking-tight text-white drop-shadow",
                compact ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl",
              ].join(" ")}
            >
              {current?.title ?? "—"}
            </h2>

            {current?.description && (
              <p
                className={[
                  "mt-2 text-zinc-100/90 drop-shadow-sm",
                  compact
                    ? "text-sm leading-relaxed line-clamp-2 md:line-clamp-3"
                    : "text-base md:text-lg leading-relaxed line-clamp-3 md:line-clamp-4",
                ].join(" ")}
              >
                {current.description}
              </p>
            )}
          </div>

          {/* CTA + dots */}
          <div className="absolute left-0 bottom-0 w-full px-5 pb-5 md:px-7 md:pb-7">
            <div className="flex items-center justify-between">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigate();
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 font-semibold text-white backdrop-blur-md ring-1 ring-white/20 hover:bg-white/15 transition"
                aria-label="Baca sekarang"
              >
                <span>Baca sekarang</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              {total > 1 && (
                <div className="flex items-center gap-2">
                  {items.map((_, i) => {
                    const base =
                      "rounded-full ring-1 ring-white/20 transition h-2.5 w-2.5 md:h-3 md:w-3";
                    const active = i === idx ? " bg-white" : " bg-white/30 hover:bg-white/50";
                    return (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          goto(i);
                        }}
                        className={base + active}
                        aria-label={`Slide ${i + 1}`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Prev / Next */}
        {total > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goto(idx - 1);
              }}
              aria-label="Sebelumnya"
              className={[
                "absolute left-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center",
                "rounded-xl bg-black/35 hover:bg-black/50 ring-1 ring-white/20 backdrop-blur-md transition",
                compact ? "h-8 w-8" : "h-10 w-10",
              ].join(" ")}
            >
              <ChevronLeft className={compact ? "h-4 w-4" : "h-5 w-5"} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                goto(idx + 1);
              }}
              aria-label="Berikutnya"
              className={[
                "absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center",
                "rounded-xl bg-black/35 hover:bg-black/50 ring-1 ring-white/20 backdrop-blur-md transition",
                compact ? "h-8 w-8" : "h-10 w-10",
              ].join(" ")}
            >
              <ChevronRight className={compact ? "h-4 w-4" : "h-5 w-5"} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
