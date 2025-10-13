import Link from "next/link";
import type { Novel } from "@/lib/db";

export default function NovelCard({ n }: { n: Novel }) {
  const cover = n.cover_url || `https://picsum.photos/seed/${n.slug}/400/560`;
  return (
    <Link href={`/novel/${n.slug}`} className="group relative overflow-hidden rounded-xl bg-white/5 border border-white/10 text-left focus:outline-none">
      <div className="aspect-[3/4] w-full overflow-hidden"><img src={cover} alt={n.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /></div>
      <div className="p-3">
        <h3 className="line-clamp-1 text-[15px] font-semibold">{n.title}</h3>
        <div className="mt-2 text-xs text-white/60">Status {n.status}</div>
      </div>
      <div className="absolute inset-0 ring-1 ring-inset ring-white/5 pointer-events-none" />
    </Link>
  );
}
