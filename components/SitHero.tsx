"use client";

import Link from "next/link";
import Image from "next/image";
import { RefreshCw, Search } from "lucide-react";
import { Dispatch, SetStateAction } from "react";
import clsx from "clsx";

export type HeroSidebarItem = {
  id: string;
  title: string;
  slug: string;
  cover_url?: string | null;
  genre?: string | null;
};

export type MiniProfile =
  | {
      id: string;
      email: string | null | undefined;
      username: string | null | undefined;
      avatar_url: string | null | undefined;
    }
  | null;

export type HeroProps = {
  q: string;
  setQ: Dispatch<SetStateAction<string>>;
  tags: readonly string[];
  filter: string;
  setFilter: Dispatch<SetStateAction<string>>;
  refreshing?: boolean;
  onRefresh?: () => void;
  me?: MiniProfile;
  title?: string;
  subtitle?: string;
  sidebar?: HeroSidebarItem[];
};

export default function Hero({
  q,
  setQ,
  tags,
  filter,
  setFilter,
  refreshing = false,
  onRefresh,
  me,
  title = "Discover",
  subtitle = "Cari & jelajahi konten terbaru",
  sidebar = [],
}: HeroProps) {
  return (
    <header className="w-full bg-gradient-to-b from-zinc-900 to-zinc-950">
      <div className="mx-auto w-[min(1240px,94vw)] px-4 py-6 md:py-8">
        {/* Title dan Profile */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              {title}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
          </div>

          {/* Profile mini + refresh */}
          <div className="flex items-center gap-3">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm",
                  "bg-zinc-900/60 hover:bg-zinc-800/60 transition"
                )}
                aria-label="Refresh"
              >
                <RefreshCw
                  className={clsx("h-4 w-4", refreshing && "animate-spin")}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}

            {me && (
              <Link
                href="/profile" // langsung literal string, bukan typed route
                className="group flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-2 py-1.5"
              >
                <div className="relative h-8 w-8 overflow-hidden rounded-full bg-zinc-800">
                  {me.avatar_url ? (
                    <Image
                      src={me.avatar_url}
                      alt={me.username ?? "avatar"}
                      fill
                      sizes="32px"
                      className="object-cover"
                      unoptimized={me.avatar_url.startsWith("http")}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                      {me.username?.[0]?.toUpperCase() ?? "U"}
                    </div>
                  )}
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-sm font-semibold leading-4">
                    {me.username ?? "User"}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {me.email ?? "—"}
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Search + Tags */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div
            className={clsx(
              sidebar.length ? "md:col-span-12" : "md:col-span-12"
            )}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari judul atau sinopsis…"
                className="w-full rounded-xl border border-white/10 bg-zinc-900/60 px-9 py-3 text-sm outline-none ring-0 placeholder:text-zinc-500"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t as string)}
                  className={clsx(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    "border-white/10 bg-zinc-900/60 hover:bg-zinc-800/60",
                    filter === t && "border-blue-500/40 bg-blue-500/10"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
