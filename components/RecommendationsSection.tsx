"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import ContentCard, { ContentCardItem } from "@/components/ContentCard";

type RecTab = "Manhwa" | "Manga" | "Manhua";
const REC_TABS: RecTab[] = ["Manhwa", "Manga", "Manhua"];

function Pill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-violet-600 text-white shadow-sm"
          : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
      )}
    >
      {children}
    </button>
  );
}

export default function RecommendationsSection({
  items,
  loading = false,
  title = "Rekomendasi",
  viewAllHref = "/search",
  className = "",
}: {
  items: any[];            // kirimkan novels (raw) dari page
  loading?: boolean;
  title?: string;
  viewAllHref?: string;
  className?: string;
}) {
  const [recTab, setRecTab] = useState<RecTab>("Manhwa");

  // Kalau nanti mau filter beneran per tab, tinggal aktifkan filter tags.includes(recTab)
  const recSource = useMemo(() => items ?? [], [items]);
  const recItems = useMemo(() => recSource.slice(0, 6), [recSource]);

  return (
    <section className={clsx("mx-auto w-[min(1280px,94vw)] px-4 pt-6", className)}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold">{title}</h2>
        <Link href={viewAllHref} className="text-sm font-semibold text-zinc-300 hover:text-white">
          Semua
        </Link>
      </div>

      {/* Filter pills (visual) */}
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {REC_TABS.map((t) => (
          <Pill key={t} active={recTab === t} onClick={() => setRecTab(t)}>
            {t}
          </Pill>
        ))}
      </div>

      {/* Loading lokal */}
      {loading && (
        <div className="mt-4 text-sm text-zinc-400">Memuat…</div>
      )}

      {/* Grid: mobile 3 → desktop 6; baris tunggal */}
      {!loading && (
        recItems.length ? (
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-6 lg:gap-3">
            {recItems.map((n: any, i: number) => {
              const item: ContentCardItem = {
                id: n.id,
                slug: n.slug,
                title: n.title,
                description: n.synopsis || n.description || "",
                cover_url: n.cover_url,
                tags: Array.isArray(n.tags) ? n.tags : null,
                created_at: n.created_at,
                updated_at: n.updated_at ?? n.created_at,
              };
              return (
                <div key={n.id} className={i >= 3 ? "hidden lg:block" : ""}>
                  <ContentCard item={item} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 text-sm text-zinc-300">
            Belum ada data untuk rekomendasi.
          </div>
        )
      )}
    </section>
  );
}
