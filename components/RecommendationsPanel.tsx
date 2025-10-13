"use client";

import Link from "next/link";
import Image from "next/image";

export type RecItem = {
  id: string;
  title: string;
  slug: string;
  cover_url?: string | null;
  genre?: string | null;
};

export default function RecommendationsPanel({
  items,
  className = "",
}: {
  items: RecItem[];
  className?: string;
}) {
  return (
    <aside
      className={`rounded-2xl border border-white/10 bg-zinc-900/60 p-3 ${className}`}
    >
      <div className="mb-2 px-1 text-sm font-semibold text-zinc-300">
        Rekomendasi
      </div>

      {/* 🧩 Tambahkan class scrollbar di sini */}
      <ul className="space-y-2 overflow-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900 hover:scrollbar-thumb-zinc-500">
        {items.map((s) => (
          <li key={s.id}>
            <Link
              href={`/novels/${s.slug}`}
              className="flex items-center gap-3 rounded-xl p-2 hover:bg-zinc-800/50"
            >
              <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-zinc-800">
                {s.cover_url && (
                  <Image
                    src={s.cover_url}
                    alt={s.title}
                    fill
                    sizes="60px"
                    className="object-cover"
                    unoptimized={s.cover_url.startsWith("http")}
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{s.title}</div>
                {s.genre && (
                  <div className="truncate text-[11px] text-zinc-400">
                    {s.genre}
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
