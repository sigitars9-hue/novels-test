"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BottomBar from "@/components/BottomBar";
import { supabase } from "@/lib/supabaseClient";
import type { Novel, Chapter } from "@/lib/db";
import CommentsSection from "@/components/CommentsSection";
import {
  MessageSquare,
  BookOpen,
  Star,
  Tag,
  Clock,
  Search as SearchIcon,
  PencilLine,
  Bookmark,
  Share2,
  Library,
  User2,
  Trash2,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Home as HomeIcon,
} from "lucide-react";
import clsx from "clsx";

function fmtDate(d?: string | null) {
  try {
    return d ? new Date(d).toLocaleDateString() : "—";
  } catch {
    return "—";
  }
}

type MiniProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  created_at?: string | null;
};

export default function NovelDetail({ params }: { params: { slug: string } }) {
  const router = useRouter();

  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // filter daftar bab
  const [q, setQ] = useState("");

  // — panel kanan —
  const [author, setAuthor] = useState<MiniProfile | null>(null);
  const [authorWorksCount, setAuthorWorksCount] = useState<number | null>(null);
  const [otherWorks, setOtherWorks] = useState<any[]>([]);
  const [bookmarkCount, setBookmarkCount] = useState<number | null>(null);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  // admin flag utk hapus
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // modal hapus
  const [showDelete, setShowDelete] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [alsoDeleteCover, setAlsoDeleteCover] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const { data: n } = await supabase
        .from("novels")
        .select("*")
        .eq("slug", params.slug)
        .single();
      setNovel(n || null);

      if (n?.id) {
        const { data: ch } = await supabase
          .from("chapters")
          .select("*")
          .eq("novel_id", n.id)
          .order("number", { ascending: true });
        setChapters(ch || []);
      } else {
        setChapters([]);
      }
      setLoading(false);
    })();
  }, [params.slug]);

  // muat panel kanan: author + stats + karya lain + status bookmark + admin flag
  useEffect(() => {
    (async () => {
      const authorId = (novel as any)?.author_id as string | undefined;
      const novelId = (novel as any)?.id as string | undefined;
      const myId = session?.user?.id as string | undefined;
      if (!novelId) return;

      // profile author
      if (authorId) {
        try {
          const { data: p } = await supabase
            .from("profiles")
            .select("id, username, avatar_url, created_at")
            .eq("id", authorId)
            .maybeSingle();
          setAuthor(
            p
              ? {
                  id: p.id,
                  username: (p as any).username ?? null,
                  avatar_url: (p as any).avatar_url ?? null,
                  created_at: (p as any).created_at ?? null,
                }
              : { id: authorId, username: null, avatar_url: null }
          );
        } catch {
          setAuthor({ id: authorId, username: null, avatar_url: null });
        }
      }

      // jumlah karya author
      if (authorId) {
        try {
          const { count } = await supabase
            .from("novels")
            .select("*", { count: "exact", head: true })
            .eq("author_id", authorId);
          setAuthorWorksCount(count ?? 0);
        } catch {
          setAuthorWorksCount(null);
        }
      } else {
        setAuthorWorksCount(null);
      }

      // 3 karya lain
      if (authorId) {
        try {
          const { data: others } = await supabase
            .from("novels")
            .select("id, slug, title, cover_url")
            .eq("author_id", authorId)
            .neq("slug", params.slug)
            .order("created_at", { ascending: false })
            .limit(3);
          setOtherWorks(others || []);
        } catch {
          setOtherWorks([]);
        }
      } else {
        setOtherWorks([]);
      }

      // jumlah bookmark + status saya
      try {
        const { count } = await supabase
          .from("bookmarks")
          .select("*", { count: "exact", head: true })
          .eq("novel_id", novelId);
        setBookmarkCount(count ?? 0);
      } catch {
        setBookmarkCount(null);
      }

      try {
        if (!myId) {
          setIsBookmarked(false);
        } else {
          const { data: mine } = await supabase
            .from("bookmarks")
            .select("novel_id")
            .eq("novel_id", novelId)
            .eq("user_id", myId)
            .maybeSingle();
          setIsBookmarked(!!mine);
        }
      } catch {
        setIsBookmarked(false);
      }

      // cek admin
      if (myId) {
        try {
          const { data: me } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", myId)
            .maybeSingle();
          setIsAdmin(!!me?.is_admin);
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    })();
  }, [novel?.id, (novel as any)?.author_id, session?.user?.id, params.slug]);

  const firstChapter = chapters[0];
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return chapters;
    return chapters.filter((c: any) => {
      const title = String(c.title ?? "").toLowerCase();
      return title.includes(term) || String(c.number ?? "").includes(term);
    });
  }, [q, chapters]);

  async function toggleBookmark() {
    const novelId = (novel as any)?.id as string | undefined;
    if (!novelId) return;
    if (!session?.user?.id) {
      await supabase.auth.signInWithOAuth({ provider: "google" });
      return;
    }
    setBookmarkBusy(true);
    try {
      if (isBookmarked) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("novel_id", novelId)
          .eq("user_id", session.user.id);
        if (error) throw error;
        setIsBookmarked(false);
        setBookmarkCount((c) => (typeof c === "number" ? Math.max(0, c - 1) : c));
      } else {
        const { error } = await supabase
          .from("bookmarks")
          .insert({ novel_id: novelId, user_id: session.user.id });
        if (error) throw error;
        setIsBookmarked(true);
        setBookmarkCount((c) => (typeof c === "number" ? c + 1 : c));
      }
    } catch {
      // ignore
    } finally {
      setBookmarkBusy(false);
    }
  }

  async function shareLink() {
    try {
      const url =
        typeof window !== "undefined"
          ? window.location.href
          : `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/novel/${params.slug}`;
      if ((navigator as any).share) {
        await (navigator as any).share({ title: (novel as any)?.title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // ignore
    }
  }

  function parseStoragePublicURL(u?: string | null) {
    if (!u) return null;
    const m = u.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: m[1], path: m[2] };
  }

  async function handleDelete() {
    if (!session?.user?.id || !novel?.id) return;
    const amOwner = (novel as any)?.author_id === session.user.id;
    if (!amOwner && !isAdmin) return;

    setDeleting(true);
    setDeleteErr(null);

    try {
      const { error: rpcErr } = await supabase.rpc("delete_novel", {
        p_novel_id: (novel as any).id,
      });

      if (rpcErr) {
        const { data: chIds } = await supabase
          .from("chapters")
          .select("id")
          .eq("novel_id", (novel as any).id);
        const ids = (chIds || []).map((x: any) => x.id);

        if (ids.length) {
          await supabase.from("chapters_comments").delete().in("chapter_id", ids);
          await supabase.from("chapters_reactions").delete().in("chapter_id", ids);
        }
        await supabase.from("chapters").delete().eq("novel_id", (novel as any).id);
        await supabase.from("bookmarks").delete().eq("novel_id", (novel as any).id);
        await supabase.from("submissions").delete().eq("novel_id", (novel as any).id);
        await supabase.from("novels").delete().eq("id", (novel as any).id);
      }

      if (alsoDeleteCover) {
        const parsed = parseStoragePublicURL((novel as any).cover_url);
        if (parsed) {
          await supabase.storage.from(parsed.bucket).remove([parsed.path]);
        }
      }

      window.location.href = "/profile";
    } catch (e: any) {
      setDeleteErr(e?.message ?? "Gagal menghapus novel.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto max-w-7xl px-4 py-6">Memuat…</main>
        <BottomBar />
      </div>
    );
  }

  if (!novel) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto max-w-7xl px-4 py-6">Novel tidak ditemukan.</main>
        <BottomBar />
      </div>
    );
  }

  const isOwner =
    session?.user?.id &&
    ((novel as any)?.author_id === session.user.id || isAdmin);
  const cover =
    (novel as any)?.cover_url || `https://picsum.photos/seed/${novel.slug}/400/560`;
  const tagsSafe: string[] = Array.isArray((novel as any)?.tags)
    ? ((novel as any)?.tags as string[])
    : [];
  const rating = (novel as any)?.rating as number | undefined | null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* ───────────────── Sticky Back/Home yang mengikuti scroll ───────────────── */}
<div
  className="sticky top-0 z-40 px-3 sm:px-8"
  style={{ paddingTop: "calc(8px + env(safe-area-inset-top, 0px))" }}
>
  {/* layer transparan + blur tipis agar kontras di atas konten apa pun */}
  <div className="pointer-events-none relative">
    <div
      aria-hidden
    />
    <div className="relative flex items-center justify-between pointer-events-auto">
      <button
        onClick={() =>
          (history.length > 1 ? router.back() : (window.location.href = "/"))
        }
        className="grid h-10 w-10 place-items-center rounded-full border border-white/5 bg-black/40 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/55 active:scale-[0.98] sm:h-11 sm:w-11"
        aria-label="Kembali"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <Link
        href="/"
        className="grid h-10 w-10 place-items-center rounded-full border border-white/5 bg-black/40 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/55 active:scale-[0.98] sm:h-11 sm:w-11"
        aria-label="Beranda"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 10l9-7 9 7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 21V10h6v11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  </div>
</div>

        {/* HERO */}
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40">
          {/* background blur */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-25"
            style={{
              backgroundImage: `url(${cover})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(24px)",
              transform: "scale(1.08)",
            }}
          />

          {/* gradient top agar icon kontras di foto terang */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-black/35 to-transparent sm:h-20"
          />

          <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[220px,1fr,320px] md:p-6">
            {/* cover */}
            <img
              src={cover}
              alt={(novel as any).title}
              className="h-[260px] w-full rounded-xl object-cover shadow sm:h-[280px]"
            />

            {/* detail utama */}
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
                  {(novel as any).title}
                </h1>

                {typeof rating === "number" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-sm font-semibold text-amber-300 ring-1 ring-amber-400/40">
                    <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                    {rating.toFixed(1)}
                  </span>
                )}
              </div>

              {/* metadata */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs md:text-sm">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  Status {(novel as any)?.status || "Ongoing"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  <BookOpen className="mr-1 inline h-4 w-4" />
                  {chapters.length} Bab
                </span>
                {(novel as any)?.updated_at && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    <Clock className="mr-1 inline h-4 w-4" />
                    Update {fmtDate((novel as any).updated_at)}
                  </span>
                )}
              </div>

              {/* tags */}
              {!!tagsSafe.length && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tagsSafe.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-zinc-800/60 px-2.5 py-1 text-xs"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* sinopsis */}
              {!!(novel as any)?.synopsis && (
                <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-200/95">
                  {(novel as any).synopsis}
                </p>
              )}

              {/* Aksi */}
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={
                    firstChapter ? `/read/${novel.slug}/${firstChapter.number}` : "#"
                  }
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm",
                    firstChapter
                      ? "bg-sky-600 hover:bg-sky-500"
                      : "cursor-not-allowed bg-zinc-800 opacity-60"
                  )}
                >
                  <BookOpen className="h-4 w-4" />
                  Mulai Baca
                </Link>

                {isOwner && (
                  <>
                    <Link
                      href={`/novel/${novel.slug}/write`}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                    >
                      <PencilLine className="h-4 w-4" />
                      Tambah Bab
                    </Link>

                    <button
                      onClick={() => {
                        setConfirmTitle("");
                        setAlsoDeleteCover(true);
                        setDeleteErr(null);
                        setShowDelete(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600/90 px-4 py-2 text-sm font-semibold hover:bg-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                      Hapus Novel
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ===== Aside kanan: Author & Stats ===== */}
            <aside className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
              <div className="mb-3 text-sm font-semibold">Author</div>

              <div className="flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-full bg-zinc-800">
                  {author?.avatar_url ? (
                    <img
                      src={author.avatar_url}
                      alt={author.username ?? "author"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-sm text-zinc-400">
                      <User2 className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {author?.username ?? "Unknown"}
                  </div>
                  <div className="text-xs text-zinc-400">
                    Bergabung {fmtDate(author?.created_at)}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
                  <div className="text-xs text-zinc-400">Karya</div>
                  <div className="text-lg font-bold">
                    {authorWorksCount ?? "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
                  <div className="text-xs text-zinc-400">Bookmark</div>
                  <div className="text-lg font-bold">
                    {bookmarkCount ?? "—"}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={toggleBookmark}
                  disabled={bookmarkBusy || bookmarkCount == null}
                  className={clsx(
                    "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm",
                    isBookmarked
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-zinc-800 hover:bg-zinc-700"
                  )}
                >
                  <Bookmark
                    className={clsx("h-4 w-4", isBookmarked && "fill-white")}
                  />
                  {isBookmarked ? "Tersimpan" : "Bookmark"}
                </button>
                <button
                  onClick={shareLink}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </div>

              {!!otherWorks.length && (
                <>
                  <div className="mt-4 mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Library className="h-4 w-4" />
                    Karya lain
                  </div>
                  <ul className="space-y-2">
                    {otherWorks.map((w) => (
                      <li key={w.id}>
                        <Link
                          href={`/novel/${w.slug}`}
                          className="flex items-center gap-2 rounded-lg p-2 hover:bg-zinc-800/50"
                        >
                          <div className="h-10 w-8 overflow-hidden rounded bg-zinc-800">
                            {w.cover_url ? (
                              <img
                                src={w.cover_url}
                                alt={w.title}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 truncate text-sm">{w.title}</div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </aside>
          </div>
        </section>

        {/* DAFTAR BAB */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/40">
          <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold">
              Daftar Bab ({filtered.length}/{chapters.length})
            </div>

            {/* search chapters */}
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari bab (judul/nomor)…"
                className="h-9 w-[min(320px,80vw)] rounded-lg border border-white/10 bg-zinc-950 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>
          </div>

          <ul className="divide-y divide-white/10">
            {filtered.map((c: any) => (
              <li
                key={c.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-white/5"
              >
                <Link href={`/read/${(novel as any).slug}/${c.number}`} className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="rounded-md bg-zinc-800/70 px-2 py-0.5 text-xs">
                      Bab {c.number}
                    </span>
                    <span className="truncate text-sm font-medium">
                      {c.title || "Tanpa Judul"}
                    </span>
                  </div>
                </Link>

                {isOwner && (
                  <Link
                    href={`/novel/${(novel as any).slug}/edit/${c.number}`}
                    className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                  >
                    Edit
                  </Link>
                )}
              </li>
            ))}

            {!filtered.length && (
              <li className="px-4 py-6 text-center text-sm text-zinc-400">
                Tidak ada bab yang cocok dengan pencarian.
              </li>
            )}

            {!chapters.length && (
              <li className="px-4 py-6 text-center text-sm text-zinc-400">
                Belum ada bab. {isOwner ? "Klik ‘Tambah Bab’ untuk mulai menulis." : ""}
              </li>
            )}
          </ul>
        </section>

        {/* KOMENTAR */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/40">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <MessageSquare className="h-4 w-4" />
            <div className="text-sm font-semibold">Komentar</div>
          </div>

          <div className="p-4">
            {firstChapter ? (
              <CommentsSection chapterId={String((firstChapter as any).id)} />
            ) : (
              <div className="text-sm text-zinc-400">
                Belum ada bab, jadi komentar belum tersedia.
              </div>
            )}
          </div>
        </section>
      </main>

      <BottomBar />

      {/* MODAL HAPUS NOVEL */}
      {showDelete && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
          <div className="w-[min(520px,95vw)] rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-red-500/15 p-2 ring-1 ring-red-400/30">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Hapus novel ini?</h3>
                <p className="mt-1 text-sm text-zinc-300">
                  Tindakan ini akan menghapus <b>novel</b>, bab-babnya, dan data terkait.
                </p>

                <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                  Ketik judul <b>“{(novel as any).title}”</b> untuk konfirmasi:
                  <input
                    value={confirmTitle}
                    onChange={(e) => setConfirmTitle(e.target.value)}
                    placeholder={(novel as any).title}
                    className="mt-2 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-600"
                  />
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={alsoDeleteCover}
                      onChange={(e) => setAlsoDeleteCover(e.target.checked)}
                    />
                    Hapus juga cover dari Storage (jika berasal dari Supabase Storage)
                  </label>
                </div>

                {deleteErr && (
                  <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {deleteErr}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowDelete(false)}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
                    disabled={deleting}
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting || confirmTitle.trim() !== (novel as any).title}
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-lg bg-red-600/90 px-4 py-2 text-sm font-semibold hover:bg-red-600",
                      (deleting || confirmTitle.trim() !== (novel as any).title) &&
                        "cursor-not-allowed opacity-60"
                    )}
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {deleting ? "Menghapus…" : "Hapus"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
