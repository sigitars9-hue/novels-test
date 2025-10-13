"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { BookOpen, ArrowUpRight, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import clsx from "clsx";

/* ---------- Utils ---------- */
function timeAgo(date?: string | null) {
  if (!date) return "–";
  const d = new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
function hashToIdx(s: string, mod: number) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}
function gradientFor(title: string) {
  const choices = [
    "from-sky-500 to-indigo-600",
    "from-blue-600 to-cyan-500",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
    "from-violet-600 to-fuchsia-500",
  ];
  return "bg-gradient-to-br " + choices[hashToIdx(title, choices.length)];
}
function initial(text?: string | null) {
  const t = (text || "N").trim();
  return (t[0] || "N").toUpperCase();
}

/* ---------- Types ---------- */
type AnyRow = Record<string, any>;
type SortKey = "recent" | "title" | "author";

/* ---------- Page ---------- */
export default function LibraryPage() {
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("novels")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows(data || []);
    } catch (e: any) {
      setErr(e?.message ?? "Gagal memuat Library.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const list = useMemo(() => {
    let r = rows;
    const query = q.trim().toLowerCase();
    if (query) {
      r = r.filter((n) => {
        const title = (n.title || "").toString().toLowerCase();
        const author = (n.author || "").toString().toLowerCase();
        const desc = (n.description || "").toString().toLowerCase();
        return title.includes(query) || author.includes(query) || desc.includes(query);
      });
    }
    if (sort === "recent") {
      r = [...r].sort((a, b) => {
        const ua = a.updated_at || a.created_at;
        const ub = b.updated_at || b.created_at;
        return (new Date(ub).getTime() || 0) - (new Date(ua).getTime() || 0);
      });
    } else if (sort === "title") {
      r = [...r].sort((a, b) =>
        (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" })
      );
    } else if (sort === "author") {
      r = [...r].sort((a, b) =>
        (a.author || "").localeCompare(b.author || "", undefined, { sensitivity: "base" })
      );
    }
    return r;
  }, [rows, q, sort]);

  async function hardRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <main className="mx-auto w-[min(1150px,95vw)] py-8">
      {/* spacer agar konten tidak ketutup BottomBar di mobile (BottomBar dipasang via segment layout) */}
      <div className="h-[64px] md:hidden -mt-[64px]" aria-hidden />

      {/* Header */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold tracking-tight">Library</h1>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari judul, penulis, deskripsi…"
              className="h-10 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-sky-600 sm:w-72"
            />
            <BookOpen className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-10 appearance-none rounded-xl border border-white/10 bg-zinc-950 px-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-sky-600"
              >
                <option value="recent">Terbaru</option>
                <option value="title">Judul (A→Z)</option>
                <option value="author">Author (A→Z)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
            </div>

            <button
              onClick={hardRefresh}
              className={clsx(
                "inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-3 text-sm hover:bg-zinc-900"
              )}
            >
              {refreshing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Refresh…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* Skeleton */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
              <div className="mb-3 h-40 w-full rounded-xl bg-zinc-800/60" />
              <div className="mb-2 h-4 w-2/3 rounded bg-zinc-800/60" />
              <div className="mb-4 h-3 w-full rounded bg-zinc-800/60" />
              <div className="h-8 w-28 rounded bg-zinc-800/60" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((n) => (
              <CardNovel key={n.id} novel={n} />
            ))}
          </div>

          {/* Empty */}
          {!err && !loading && list.length === 0 && (
            <div className="mt-10 grid place-items-center">
              <div className="w-[min(560px,90vw)] rounded-2xl border border-white/10 bg-zinc-900/40 p-6 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-zinc-800">
                  <BookOpen className="h-6 w-6 opacity-70" />
                </div>
                <div className="text-base font-semibold">Tidak ada hasil</div>
                <p className="mt-1 text-sm opacity-70">Coba kata kunci lain atau ubah urutan sort.</p>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

/* ---------- Card ---------- */
function CardNovel({ novel }: { novel: AnyRow }) {
  const title: string = novel.title ?? "Tanpa judul";
  const slug: string = novel.slug ?? "";
  const author: string | null = novel.author ?? null;
  const desc: string | null = novel.description ?? null;
  const cover: string | null = novel.cover_url ?? null;
  const updated: string | null = novel.updated_at ?? novel.created_at ?? null;

  return (
    <Link
      href={slug ? (`/novel/${slug}` as any) : "#"}
      className={clsx(
        "group relative block overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-4",
        "transition-colors hover:border-sky-500/40 hover:bg-zinc-900"
      )}
    >
      {/* Cover */}
      <div className="relative mb-3 h-40 w-full overflow-hidden rounded-xl">
        {cover ? (
          <img
            src={cover}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className={clsx(
              "flex h-full w-full items-center justify-center rounded-xl text-5xl font-bold text-white/90",
              gradientFor(title)
            )}
          >
            {initial(title)}
          </div>
        )}

        <div className="pointer-events-none absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/40 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <ArrowUpRight className="h-5 w-5" />
        </div>
      </div>

      {/* Body */}
      <div className="mb-1 truncate text-lg font-semibold">{title}</div>
      {author && <div className="text-xs uppercase tracking-wide text-zinc-400">{author}</div>}
      {desc && <p className="mt-2 line-clamp-2 text-sm leading-relaxed opacity-80">{desc}</p>}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs opacity-60">
          Updated <span className="font-medium opacity-80">{timeAgo(updated)}</span> ago
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800/60 px-2 py-1 text-xs">
          <BookOpen className="h-3.5 w-3.5" />
          Baca
        </div>
      </div>
    </Link>
  );
}
