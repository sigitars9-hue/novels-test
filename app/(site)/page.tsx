"use client";

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
import RecommendationsPanel from "../../components/RecommendationsPanel";


const TAGS = ["All", "Fantasy", "Sci-Fi", "Romance", "Adventure", "Mystery"] as const;

export default function HomePage() {
  const [novels, setNovels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // 🔍 untuk Hero (search & filter)
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [filter, setFilter] = useState<string>("All");
  const [refreshing, setRefreshing] = useState(false);

  // 👤 data profile user
  const [me, setMe] = useState<{
    id: string;
    email: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null>(null);

  // Ambil profil user dari Supabase
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

  // Ambil daftar novel dari database
  async function fetchNovels() {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from("novels")
      .select("id, slug, title, synopsis, cover_url, tags, rating, created_at")
      .order("created_at", { ascending: false });

    if (error) setErr(error.message);
    setNovels(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchNovels();
  }, []);

  // debounce untuk pencarian
  useEffect(() => {
    const t = setTimeout(() => setQLive(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Filter dan pencarian
  const list = useMemo(() => {
    let arr = [...novels];
    if (filter !== "All") {
      arr = arr.filter((n: any) => Array.isArray(n.tags) && n.tags.includes(filter));
    }
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

  // Data highlight carousel
  const highlights: HighlightItem[] = (list.slice(0, 5) as any[]).map((n) => ({
    id: String(n.id),
    title: n.title,
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

  // Data pengumuman
  const ann: Announcement[] = [
    { id: "a3", title: "Perubahan Kebijakan Moderasi", date_str: "15 Jun 2025" },
    { id: "a2", title: "Maintenance Terjadwal", date_str: "20 Jul 2025", warn: true },
    { id: "a1", title: "Rekrutmen Tim Pengembangan", date_str: "03 Aug 2025" },
  ];

  const featured = list.slice(0, 3);
  const rest = list.slice(3);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Hero Section */}
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
        subtitle="Jelajahi karya terbaru. Aksen biru, nyaman dibaca."
        sidebar={list.slice(0, 4).map((n: any) => ({
          id: String(n.id),
          title: n.title,
          slug: n.slug,
          cover_url: n.cover_url || null,
          genre: Array.isArray(n.tags) ? n.tags[0] : null,
        }))}
      />

<section className="mx-auto w-[min(1240px,94vw)] px-4">
  <div className="md:grid md:grid-cols-12 md:gap-4 items-stretch">
    {/* Kiri: Carousel */}
    <div className="md:col-span-8">
      <div className="md:h-[280px]">            {/* tinggi patokan */}
        <HighlightCarousel items={highlights} compact className="h-full" />
      </div>
    </div>

    {/* Kanan: Rekomendasi */}
    <div className="md:col-span-4 mt-4 md:mt-0">
      <RecommendationsPanel
        items={list.slice(0, 6).map((n: any) => ({
          id: String(n.id),
          title: n.title,
          slug: n.slug,
          cover_url: n.cover_url || null,
          genre: Array.isArray(n.tags) ? n.tags[0] : null,
        }))}
        className="h-full md:h-[210px] flex flex-col"
      />
    </div>
  </div>
</section>
      {/* Pengumuman */}
      <section className="mx-auto w-[min(1240px,94vw)] px-4 py-5">
        <Announcements items={ann} />
      </section>

      {/* Daftar Konten */}
      <section className="mx-auto w-[min(1240px,94vw)] px-4 pb-10">
        {err && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat…
          </div>
        ) : list.length ? (
          <>
            {featured.length > 0 && (
              <div className="mb-5 grid gap-4 md:grid-cols-3">
                {featured.map((n: any) => {
                  const item: ContentCardItem = {
                    id: n.id,
                    slug: n.slug,
                    title: n.title,
                    description: n.synopsis || "",
                    cover_url: n.cover_url,
                    tags: Array.isArray(n.tags) ? n.tags : null,
                    created_at: n.created_at,
                    updated_at: n.created_at,
                  };
                  return <ContentCard key={n.id} item={item} />;
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {rest.map((n: any) => {
                const item: ContentCardItem = {
                  id: n.id,
                  slug: n.slug,
                  title: n.title,
                  description: n.synopsis || "",
                  cover_url: n.cover_url,
                  tags: Array.isArray(n.tags) ? n.tags : null,
                  created_at: n.created_at,
                  updated_at: n.created_at,
                };
                return <ContentCard key={n.id} item={item} />;
              })}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 text-sm text-zinc-300">
            Tidak ada hasil. Coba ubah filter atau kata kunci.
          </div>
        )}
      </section>

      <BottomBar />
    </div>
  );
}
