"use client";

import { ArrowLeft, Loader2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import clsx from "clsx";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  id: string;
  title: string;
  body: string;
  level: "info" | "warning" | "danger" | null;
  created_at: string;
  pinned?: boolean | null;
};

function badgeColor(level?: Row["level"]) {
  switch (level) {
    case "danger":
      return "bg-red-500/15 text-red-300 ring-1 ring-red-400/30";
    case "warning":
      return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30";
    default:
      return "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/30";
  }
}

export default function AnnouncementsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase
        .from("announcements")
        .select("id,title,body,level,created_at,pinned")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) setErr(error.message);
      setItems((data as Row[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto w-[min(880px,94vw)] px-3 py-5 sm:px-4">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-xl bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          >
            <ArrowLeft className="mr-1 inline h-4 w-4" />
            Kembali
          </button>
          <h1 className="ml-1 text-xl font-extrabold sm:text-2xl">Pengumuman</h1>
          <div className="ml-auto text-sm opacity-70">
            {items.length} item
          </div>
        </div>

        {err && (
          <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
            Belum ada pengumuman.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((a) => (
              <AnnouncementCard key={a.id} a={a} />
            ))}
          </ul>
        )}

        {/* CTA kembali ke home (mobile friendly) */}
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Beranda
          </Link>
        </div>
      </main>
    </div>
  );
}

function AnnouncementCard({ a }: { a: Row }) {
  const [open, setOpen] = useState(false);
  const badge = badgeColor(a.level);

  const levelText = useMemo(() => {
    if (a.level === "danger") return "Kritis";
    if (a.level === "warning") return "Peringatan";
    return "Info";
  }, [a.level]);

  return (
    <li
      className={clsx(
        // ⚠️ Tidak ada overflow-hidden di wrapper card
        "rounded-2xl border border-white/10 bg-zinc-900/40 p-2 sm:p-2.5"
      )}
    >
      {/* Header (klik untuk expand) – boleh punya overflow sendiri */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5",
          a.level === "danger"
            ? "ring-1 ring-red-400/20"
            : a.level === "warning"
            ? "ring-1 ring-amber-400/20"
            : "ring-1 ring-white/10"
        )}
      >
        {/* Icon level */}
        <div
          className={clsx(
            "grid h-10 w-10 place-items-center rounded-xl",
            a.level === "danger"
              ? "bg-red-500/10 ring-1 ring-red-400/30"
              : a.level === "warning"
              ? "bg-amber-500/10 ring-1 ring-amber-400/30"
              : "bg-sky-500/10 ring-1 ring-sky-400/30"
          )}
        >
          <span className="text-xs opacity-80">
            {a.level === "danger" ? "!" : a.level === "warning" ? "⚠" : "ⓘ"}
          </span>
        </div>

        {/* Title + tanggal */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {a.pinned ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                PENTING
              </span>
            ) : null}
            <h3 className="truncate text-base font-semibold sm:text-lg">
              {a.title}
            </h3>
          </div>
          <div className="mt-0.5 text-xs text-zinc-400">
            {new Date(a.created_at).toLocaleDateString()}
          </div>
        </div>

        <div className="shrink-0">
          <ChevronDown
            className={clsx(
              "h-5 w-5 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Body – ANIMASI TANPA CLIP */}
      <div
        className={clsx(
          "overflow-hidden transition-[max-height] duration-300 ease-in-out",
          open ? "max-h-[1200px]" : "max-h-0"
        )}
      >
        <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
          {/* level badge – tidak akan kepotong karena parent tidak menggunting */}
          <span className={clsx("mb-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", badge)}>
            {levelText}
          </span>

          {/* body */}
          <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-zinc-200/95">
            {a.body}
          </p>
        </div>
      </div>
    </li>
  );
}
