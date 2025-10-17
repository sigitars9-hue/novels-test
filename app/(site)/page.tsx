"use client";
// paling atas imports:
import LoadingSplash from "@/components/LoadingSplash";
import { useRef } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import { supabase } from "@/lib/supabaseClient";

import BottomBar from "@/components/BottomBar";
import HighlightCarousel, { HighlightItem } from "@/components/HighlightCarousel";
import Announcements, { Announcement } from "@/components/Announcements";
import ContentCard, { ContentCardItem } from "@/components/ContentCard";
import Hero from "@/components/SitHero";
import SeriesPosterCard, { SeriesPoster } from "@/components/SeriesPosterCard";
import RecommendationsSection from "@/components/RecommendationsSection";


const TAGS = ["All", "Fantasy", "Sci-Fi", "Romance", "Adventure", "Mystery"] as const;
const GRID_LIMIT = 24;

/* ───────────────── Types kecil untuk chips chapter ───────────────── */
type MiniChapter = {
  id: string;
  novel_id: string;
  number: number;              // ganti ke field kamu kalau berbeda
  title: string | null;
  slug?: string | null;        // opsional jika kamu punya slug chapter
  updated_at?: string | null;
  created_at?: string | null;
};

export default function HomePage() {
  const [novels, setNovels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [filter, setFilter] = useState<string>("All");
  const [refreshing, setRefreshing] = useState(false);
// ===== Splash overlay logic (HARUS setelah loading/refreshing sudah ada) =====
const splashStartRef = useRef<number | null>(null);
const splashOn = loading || refreshing;
const [splashVisible, setSplashVisible] = useState(false);

useEffect(() => {
  let t: any;
  if (splashOn) {
    setSplashVisible(true);
    splashStartRef.current = performance.now();
  } else {
    const elapsed = (performance.now() - (splashStartRef.current ?? 0)) || 0;
    const remain = Math.max(0, 400 - elapsed); // tampil minimal 400ms biar tidak “kedip”
    t = setTimeout(() => setSplashVisible(false), remain);
  }
  return () => clearTimeout(t);
}, [splashOn]);
// ============================================================================

  const [me, setMe] = useState<{
    id: string;
    email: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null>(null);

  /* ───────── state: map novel_id -> 2 chapter terbaru ───────── */
  const [chaptersByNovel, setChaptersByNovel] = useState<Record<string, MiniChapter[]>>({});

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return setMe(null);

      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      setMe({
        id: user.id,
        email: user.email ?? null,
        username: p?.username ?? null,
        avatar_url: p?.avatar_url ?? null,
      });
    })();
  }, []);

  /* ───────── util waktu relatif ───────── */
  function timeAgo(iso?: string | null) {
    if (!iso) return "—";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "—";
    const diff = Math.max(0, Date.now() - t);
    const m = Math.floor(diff / 60000);
    if (m < 1) return "baru saja";
    if (m < 60) return `${m} mnt`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} jam`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d} hari`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return `${mo} bln`;
    const y = Math.floor(mo / 12);
    return `${y} th`;
  }

  /* ───────── builder href baca chapter ─────────
     Ubah sesuai pola route kamu, contoh:
     /novel/[slug]/chapter/[number]
  */
 function chapterHref(novelSlug: string, ch: MiniChapter) {
  // target: /novel/read/[slug]/[number]
  return `/read/${novelSlug}/${ch.number}`;
}


  /* ───────── fetch 2 chapter terbaru per novel ───────── */
  async function fetchLatestChaptersByNovel(novelIds: string[]) {
    if (!novelIds.length) {
      setChaptersByNovel({});
      return;
    }

    const { data, error } = await supabase
      .from("chapters")
      .select("id, novel_id, number, title, slug, updated_at, created_at")
      .in("novel_id", novelIds)
      // ganti urutan sesuai yang kamu anggap “terbaru”
      .order("number", { ascending: false });

    if (error) {
      console.error(error);
      setChaptersByNovel({});
      return;
    }

    const grouped: Record<string, MiniChapter[]> = {};
    for (const ch of (data || []) as MiniChapter[]) {
      const key = ch.novel_id;
      if (!grouped[key]) grouped[key] = [];
      if (grouped[key].length < 2) grouped[key].push(ch);
    }
    setChaptersByNovel(grouped);
  }

  async function fetchNovels() {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
  .from("novels")
  .select("id, slug, title, synopsis, cover_url, tags, rating, created_at")
  .order("created_at", { ascending: false });


    if (error) setErr(error.message);
    const list = data || [];
    setNovels(list);

    // ⤵️ setelah daftar novel didapat, tarik chips 2 chapter terbaru
    await fetchLatestChaptersByNovel(list.map((n: any) => n.id));

    setLoading(false);
  }
  useEffect(() => { fetchNovels(); }, []);

  useEffect(() => {
    const t = setTimeout(() => setQLive(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const list = useMemo(() => {
    let arr = [...novels];
    if (filter !== "All") arr = arr.filter((n: any) => Array.isArray(n.tags) && n.tags.includes(filter));
    const term = qLive.trim().toLowerCase();
    if (term) {
      arr = arr.filter((n: any) => {
        const title = (n.title || "").toLowerCase();
        const syn = (n.synopsis || "").toLowerCase();
        return title.includes(term) || syn.includes(term);
      });
    }
    return arr;
  }, [novels, filter, qLive]);

  async function hardRefresh() {
    setRefreshing(true);
    await fetchNovels();
    setRefreshing(false);
  }

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

  const highlights: HighlightItem[] = (list.slice(0, 5) as any[]).map((n) => ({
    id: String(n.id),
    title: n.title,
    slug: n.slug,
    description: n.synopsis || "",
    cover_url:
      n.cover_url ||
      "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='700'>
             <defs>
               <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
                 <stop offset='0' stop-color='#7dd3fc'/>
                 <stop offset='1' stop-color='#1e3a8a'/>
               </linearGradient>
             </defs>
             <rect width='100%' height='100%' fill='url(#g)'/>
           </svg>`
        ),
    genre: Array.isArray(n.tags) ? n.tags[0] : null,
    rating: n.rating ?? null,
  }));

  const ann: Announcement[] = [
    { id: "a3", title: "Pengumuman Rekrutmen Pengembangan Aplikasi", date_str: "03 August 2025" },
    { id: "a2", title: "Pengumuman Maintenance", date_str: "20 July 2025", warn: true },
  ];

  const featured = list.slice(0, 3);
  const gridItems = list.slice(0, GRID_LIMIT);

  return (
<div className="min-h-screen bg-zinc-950 text-zinc-100 pb-[calc(84px+env(safe-area-inset-bottom))]">

      {/* Hero */}
      <Hero
        q={q}
        setQ={setQ}
        tags={TAGS}
        filter={filter}
        setFilter={setFilter}
        refreshing={refreshing}
        onRefresh={hardRefresh}
        me={me}
        title="Gachaverse"
        subtitle="Komunitas dengan mayoritas halu."
        sidebar={list.slice(0, 4).map((n: any) => ({
          id: String(n.id),
          title: n.title,
          slug: n.slug,
          cover_url: n.cover_url || null,
          genre: Array.isArray(n.tags) ? n.tags[0] : null,
        }))}
      />
{/* HEADER: Highlight (kiri) + Pengumuman (kanan) */}
<section className="mx-auto w-[min(1320px,95vw)] px-4 mt-0">
  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
    {/* Kiri */}
    <div className="md:col-span-8 self-start">
      <HighlightCarousel
        items={highlights}
        basePath="/novel"
        height="h-[190px] md:h-[230px]"   // ✅ lebih pendek dan pas proporsinya
        className="w-full"
      />
    </div>

    {/* Kanan */}
    <div className="md:col-span-4 self-start">
      <Announcements items={ann} />
    </div>
  </div>
</section>




      {/* ————————————————— Rekomendasi ————————————————— */}
      {(() => {
        // (DIBIARKAN sesuai kode kamu)
        const REC_TABS = ["Manhwa", "Manga", "Manhua"] as const;
        const [recTab, setRecTab] = useState<(typeof REC_TABS)[number]>("Manhwa");
        const topSix = list.slice(0, 6);
        const recItems = Array.isArray(topSix) && topSix.length ? topSix : [];

        return (
          <section className="mx-auto w-[min(1280px,94vw)] px-4 pt-6">
            {/* Header */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-extrabold">Rekomendasi</h2>
            </div>

            {/* Filter pills */}
            <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {REC_TABS.map((t) => (
                <Pill key={t} active={recTab === t} onClick={() => setRecTab(t)}>
                  {t}
                </Pill>
              ))}
            </div>

            {/* Grid: mobile 3 → desktop 6; baris tunggal */}
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-6 lg:gap-3">
              {recItems.map((n: any, i: number) => {
                const item: ContentCardItem = {
                  id: n.id,
                  slug: n.slug,
                  title: n.title,
                  synopsis: n.synopsis || n.description || "",
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
          </section>
        );
      })()}

      {loading ? (
        /* ⛔ DIMINTA: jangan disentuh */
        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat…
        </div>
      ) : (
        list.length ? <></> : (
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 text-sm text-zinc-300">
            Tidak ada hasil. Coba ubah filter atau kata kunci.
          </div>
        )
      )}

      {/* ——————————— Konten Kedua: Populer ——————————— */}
      <section className="mx-auto w-[min(1280px,94vw)] px-4 pt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-extrabold">Top Halu</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-6">
          {(list.slice(0, 24) as any[]).map((n: any) => {
            // ⤵️ chips diambil dari state chaptersByNovel (2 terbaru)
 const chips =
  (chaptersByNovel[n.id]?.length
    ? chaptersByNovel[n.id].slice(0, 2).map((ch) => ({
        label: `Chapter ${ch.number}`,
        time: timeAgo(ch.updated_at || ch.created_at),
        href: chapterHref(n.slug, ch),
      }))
    : Array.from({ length: 2 }, () => ({
        label: "Chapter —",  // placeholder
        time: "—",           // placeholder
        // tanpa href -> tidak bisa diklik, hanya menjaga tinggi/posisi
      }))
  );


            return (
              <SeriesPosterCard
                key={n.id}
                item={{
                  id: n.id,
                  slug: n.slug,
                  title: n.title,
                  cover_url: n.cover_url,
                  created_at: n.created_at,
                  updated_at: n.updated_at ?? n.created_at,
                  flag_url: n.flag_url, // biarkan apa adanya
                  chapters: chips,
                } as SeriesPoster}
              />
            );
          })}
        </div>
      </section>

      <BottomBar />
      <LoadingSplash
  show={splashVisible}
  title="Menyiapkan konten"
  subtitle={refreshing ? "Menyegarkan data…" : "Memuat data dari server…"}
/>

    </div>
  );
}
