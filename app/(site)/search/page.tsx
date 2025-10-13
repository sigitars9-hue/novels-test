"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Search as SearchIcon, X, Clock, Tag } from "lucide-react";
import clsx from "clsx";
import { supabase } from "@/lib/supabaseClient";
import BottomBar from "@/components/BottomBar";

type Row = {
  id: string;
  title: string;
  slug: string;
  synopsis?: string | null;
  cover_url?: string | null;
  tags?: string[] | null;
};

const RECENT_KEY = "search.recent.v1";
const DEBOUNCE_MS = 350;

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  // cegah race condition: hanya respon terakhir yang dipakai
  const reqId = useRef(0);

  // load recent dari localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, []);

  const saveRecent = (term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recent.filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
  };

  const clearRecent = () => {
    setRecent([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {}
  };

  const sanitized = useMemo(
    () => q.replace(/[%]/g, "").replace(/[,]/g, " "),
    [q]
  );
  const hasQuery = sanitized.trim().length > 0;

  async function runSearch(manual = false) {
    setErr(null);

    const query = sanitized.trim();
    if (!query) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (manual) setTouched(true);
    const myId = ++reqId.current;

    try {
      const pattern = `%${query}%`;
      // NOTE: hanya kolom yang ADA pada schema kamu
      const { data, error } = await supabase
        .from("novels")
        .select("id, slug, title, synopsis, cover_url, tags")
        .or(`title.ilike.${pattern},synopsis.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      if (myId !== reqId.current) return; // abaikan kalau sudah ada request yang lebih baru

      setRows((data as Row[]) || []);
      saveRecent(query);
    } catch (e: any) {
      if (myId !== reqId.current) return;
      setErr(e?.message ?? "Gagal melakukan pencarian.");
      setRows([]);
    } finally {
      if (myId === reqId.current) setLoading(false);
    }
  }

  // debounce otomatis saat mengetik
  useEffect(() => {
    if (!hasQuery) {
      setRows([]);
      setErr(null);
      setLoading(false);
      return;
    }
    const t = setTimeout(() => runSearch(false), DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sanitized]);

  // shortcut fokus: "/" atau Ctrl/⌘+K
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      if (e.key === "/" || isCmdK) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen">
      <main className="mx-auto w-[min(1100px,95vw)] py-8">
        <h1 className="mb-4 text-2xl font-extrabold tracking-tight">Search</h1>

        {/* Search box */}
        <div
          className={clsx(
            "group relative mb-6 rounded-2xl border bg-zinc-900/50 backdrop-blur",
            "border-white/10 focus-within:border-sky-500/40 focus-within:ring-2 focus-within:ring-sky-500/20"
          )}
        >
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-sky-300" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch(true)}
            placeholder='Cari judul / sinopsis…  (tekan "/" atau Ctrl/⌘+K untuk fokus)'
            className="h-12 w-full rounded-2xl bg-transparent pl-11 pr-20 text-sm outline-none placeholder:text-zinc-500"
            autoComplete="off"
          />

          {/* tombol clear */}
          {q && !loading && (
            <button
              onClick={() => {
                setQ("");
                setRows([]);
                setErr(null);
                inputRef.current?.focus();
              }}
              className="absolute right-11 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* tombol Cari */}
          <button
            onClick={() => runSearch(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold hover:bg-sky-500"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SearchIcon className="h-4 w-4" />
            )}
            <span>{loading ? "Mencari…" : "Cari"}</span>
          </button>
        </div>

        {/* Recent searches */}
        {!loading && !err && !rows.length && !touched && recent.length > 0 && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-zinc-900/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300">
                <Clock className="h-4 w-4" />
                Pencarian terakhir
              </div>
              <button
                onClick={clearRecent}
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                Hapus
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recent.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setQ(s);
                    setTouched(true);
                    // runSearch terpanggil oleh effect debounce
                  }}
                  className="rounded-full border border-white/10 bg-zinc-800/60 px-3 py-1 text-xs hover:bg-zinc-700/60"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {err && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {err}
          </div>
        )}

        {/* Result header */}
        {hasQuery && !err && (
          <div className="mb-2 text-sm text-zinc-400">
            {loading ? "Mencari…" : `Ditemukan ${rows.length} hasil`}
          </div>
        )}

        {/* Results / Skeleton */}
        {loading ? (
          <ul className="grid gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <li
                key={i}
                className="h-[96px] animate-pulse rounded-xl border border-white/10 bg-zinc-900/40"
              />
            ))}
          </ul>
        ) : (
          <ul className="grid gap-3">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/novel/${r.slug}`}
                  className="flex gap-3 rounded-xl border border-white/10 bg-zinc-900/40 p-3 transition-colors hover:bg-zinc-900/70"
                >
                  {/* thumbnail */}
                  <div className="relative hidden h-16 w-12 overflow-hidden rounded-md bg-zinc-800 sm:block">
                    {r.cover_url ? (
                      <Image
                        src={r.cover_url}
                        alt={r.title}
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized={r.cover_url.startsWith("http")}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold">{r.title}</div>
                    {r.synopsis && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-zinc-300">
                        {r.synopsis}
                      </p>
                    )}
                    {Array.isArray(r.tags) && r.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                        <Tag className="h-3 w-3" />
                        {r.tags.slice(0, 3).map((t, i) => (
                          <span
                            key={`${t}-${i}`}
                            className="rounded-full border border-white/10 bg-zinc-800/60 px-2 py-0.5"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Empty state */}
        {!loading && !err && hasQuery && rows.length === 0 && (
          <div className="mt-4 rounded-xl border border-white/10 bg-zinc-900/40 p-4 text-sm text-zinc-300">
            Tidak ada hasil untuk <span className="font-semibold">“{sanitized}”</span>.
            Coba kata lain atau lebih spesifik.
          </div>
        )}
      </main>

      {/* Spacer & Bottom bar */}
      <div className="h-[64px] md:hidden" aria-hidden />
      <BottomBar />
    </div>
  );
}
