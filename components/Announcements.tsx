"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import clsx from "clsx";

export type Announcement = {
  id: string;
  title: string;
  date_str?: string | null;
  created_at?: string | null;
  icon?: string | null;
  warn?: boolean;
};

type Props = {
  items: Announcement[];
  pageSize?: number;     // default 2
  autoPlay?: boolean;    // default true
  intervalMs?: number;   // default 6000
  className?: string;
};

/* ─────────────── util: format waktu ─────────────── */
function timeAgo(date?: string | null) {
  if (!date) return "";
  const d = new Date(date);
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  if (dd < 30) return `${dd}d ago`;
  const mo = Math.floor(dd / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(mo / 12);
  return `${y}y ago`;
}

/* ─────────────── komponen utama ─────────────── */
export default function Announcements({
  items,
  pageSize = 2,
  autoPlay = true,
  intervalMs = 6000,
  className,
}: Props) {
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const start = page * pageSize;
  const slice = useMemo(
    () => items.slice(start, start + pageSize),
    [items, start, pageSize]
  );

  /* ─────────────── navigasi ─────────────── */
  const goto = (p: number) => {
    if (totalPages <= 1) return;
    if (p < 0) p = totalPages - 1;
    if (p >= totalPages) p = 0;
    setPage(p);
  };

  /* ─────────────── auto rotate ─────────────── */
  useEffect(() => {
    if (!autoPlay || paused || totalPages <= 1) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = setInterval(() => {
      setPage((prev) => (prev + 1 >= totalPages ? 0 : prev + 1));
    }, intervalMs);

    // ✅ cleanup yang aman
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoPlay, paused, totalPages, intervalMs]);

  /* ─────────────── keyboard nav ─────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goto(page - 1);
      else if (e.key === "ArrowRight") goto(page + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [page, totalPages]);

  /* ─────────────── kunci tinggi halaman ─────────────── */
  const ITEM_H = 72;
  const GAP = 12;
  const pageMinHeight = ITEM_H * pageSize + GAP * (pageSize - 1);
  const displayed = useMemo(() => {
    if (slice.length >= pageSize) return slice;
    return [...slice, ...Array(pageSize - slice.length).fill(null)];
  }, [slice, pageSize]);

  /* ─────────────── render ─────────────── */
  return (
    <aside
      className={clsx(
        "rounded-3xl border border-white/10 bg-zinc-900/40 p-4",
        "ring-1 ring-transparent focus-within:ring-sky-500",
        className
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-2xl font-extrabold tracking-tight">Pengumuman</h3>
        <a
          href="/announcement"
          className="rounded-md px-1 text-sm text-zinc-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          Semua
        </a>
      </div>

      {/* Kosong */}
      {!items.length ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
          Belum ada pengumuman.
        </div>
      ) : (
        <>
          {/* wrapper agar tinggi stabil */}
          <div
            style={{ minHeight: pageMinHeight }}
            className="transition-[min-height] duration-200"
          >
            <ul className="space-y-3" aria-live="polite">
              {displayed.map((a, i) => {
                if (!a) {
                  return (
                    <li
                      key={`ph-${i}`}
                      className="h-[72px] opacity-0 pointer-events-none"
                      aria-hidden="true"
                    />
                  );
                }

                const dateLabel =
                  a.date_str && a.date_str.trim()
                    ? a.date_str
                    : a.created_at
                    ? timeAgo(a.created_at)
                    : "";

                return (
                  <li
                    key={a.id}
                    className={clsx(
                      "flex items-center gap-3 rounded-2xl border p-3 h-[72px]",
                      a.warn
                        ? "border-amber-500/30 bg-amber-500/10"
                        : "border-white/10 bg-zinc-900/60"
                    )}
                  >
                    <div
                      className={clsx(
                        "grid h-14 w-14 place-items-center overflow-hidden rounded-xl",
                        a.warn ? "bg-amber-500/15" : "bg-zinc-800"
                      )}
                    >
                      {a.icon ? (
                        <img
                          src={a.icon}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : a.warn ? (
                        <AlertTriangle className="h-6 w-6 text-amber-300" />
                      ) : (
                        <div className="text-2xl">📣</div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {a.warn && (
                          <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200 ring-1 ring-amber-400/30">
                            Penting
                          </span>
                        )}
                        <div className="truncate font-semibold">{a.title}</div>
                      </div>
                      {dateLabel && (
                        <div className="text-xs text-zinc-400">{dateLabel}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Pager */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => goto(page - 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900/80 ring-1 ring-white/10 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-label="Sebelumnya"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goto(i)}
                    className={clsx(
                      "h-2.5 w-2.5 rounded-full",
                      i === page ? "bg-white" : "bg-white/30 hover:bg-white/60"
                    )}
                    aria-label={`Halaman ${i + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={() => goto(page + 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900/80 ring-1 ring-white/10 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-label="Berikutnya"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
