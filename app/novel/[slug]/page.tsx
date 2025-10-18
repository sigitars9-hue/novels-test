"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  ArrowLeft,
  Home as HomeIcon,
  Star,
  Clock,
  Tag,
  BookOpen,
  Bookmark,
  Share2,
  Edit3,
  FilePlus2,
  Trash2,
  MessageSquare as MessageSquareIcon,
  PencilLine,
  MoreVertical,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import type { Novel, Chapter } from "@/lib/db";
import BottomBar from "@/components/BottomBar";
import CommentsSection from "@/components/CommentsSection";
import LoadingSplash from "@/components/LoadingSplash";
import { genreStyle } from "@/lib/genreStyles";

/* ───────────────── helpers ───────────────── */
function fmtDate(d?: string | null) {
  try {
    return d ? new Date(d).toLocaleDateString() : "—";
  } catch {
    return "—";
  }
}
type MiniProfile = { id: string; username: string | null; avatar_url: string | null; created_at?: string | null };

/* ───────────────── page ───────────────── */
export default function NovelDetail({ params }: { params: { slug: string } }) {
  const router = useRouter();

  /* data / session */
  const [session, setSession] = useState<any>(null);
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  /* right panel + stats */
  const [author, setAuthor] = useState<MiniProfile | null>(null);
  const [authorWorksCount, setAuthorWorksCount] = useState<number | null>(null);
  const [otherWorks, setOtherWorks] = useState<any[]>([]);
  const [bookmarkCount, setBookmarkCount] = useState<number | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  /* ui */
  const [q, setQ] = useState("");
  const [deletingNovel, setDeletingNovel] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [alsoDeleteCover, setAlsoDeleteCover] = useState(true);

  /* session */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  /* fetch novel + chapters */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const { data: n } = await supabase
        .from("novels")
        .select("*")
        .eq("slug", params.slug)
        .maybeSingle();

      if (!alive) return;
      setNovel(n || null);

      if (n?.id) {
        const { data: ch } = await supabase
          .from("chapters")
          .select("*")
          .eq("novel_id", n.id)
          .order("number", { ascending: true });
        if (!alive) return;
        setChapters(ch || []);
      } else {
        setChapters([]);
      }

      setLoading(false);
      setTimeout(() => setShowSplash(false), 150);
    })();
    return () => {
      alive = false;
    };
  }, [params.slug]);

  /* side data (author, bookmarks, admin flag) */
  useEffect(() => {
    (async () => {
      const novelId = (novel as any)?.id as string | undefined;
      const authorId = (novel as any)?.author_id as string | undefined;
      const myId = session?.user?.id as string | undefined;
      if (!novelId) return;

      // author
      if (authorId) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, created_at")
          .eq("id", authorId)
          .maybeSingle();
        setAuthor(
          p
            ? { id: p.id, username: (p as any).username ?? null, avatar_url: (p as any).avatar_url ?? null, created_at: (p as any).created_at ?? null }
            : { id: authorId, username: null, avatar_url: null }
        );

        const { count } = await supabase
          .from("novels")
          .select("*", { count: "exact", head: true })
          .eq("author_id", authorId);
        setAuthorWorksCount(count ?? 0);

        const { data: ow } = await supabase
          .from("novels")
          .select("id, slug, title, cover_url")
          .eq("author_id", authorId)
          .neq("slug", params.slug)
          .order("created_at", { ascending: false })
          .limit(3);
        setOtherWorks(ow || []);
      } else {
        setAuthor(null);
        setAuthorWorksCount(null);
        setOtherWorks([]);
      }

      // bookmarks (count + mine)
      const { count } = await supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("novel_id", novelId);
      setBookmarkCount(count ?? 0);

      if (myId) {
        const { data: mine } = await supabase
          .from("bookmarks")
          .select("novel_id")
          .eq("novel_id", novelId)
          .eq("user_id", myId)
          .maybeSingle();
        setIsBookmarked(!!mine);

        const { data: me } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", myId)
          .maybeSingle();
        setIsAdmin(!!me?.is_admin);
      } else {
        setIsBookmarked(false);
        setIsAdmin(false);
      }
    })();
  }, [novel?.id, (novel as any)?.author_id, session?.user?.id, params.slug]);

  /* derived */
  const firstChapter = chapters[0];
  const isOwner = !!session?.user?.id && ((novel as any)?.author_id === session.user.id || isAdmin);
  const cover =
    (novel as any)?.cover_url || (novel ? `https://picsum.photos/seed/${novel.slug}/600/800` : "");
  const tagsSafe: string[] = Array.isArray((novel as any)?.tags) ? ((novel as any)?.tags as string[]) : [];
  const rating = (novel as any)?.rating as number | undefined | null;
  const mainStyle = genreStyle(tagsSafe?.[0]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return chapters;
    return chapters.filter((c: any) => {
      const title = String(c.title ?? "").toLowerCase();
      return title.includes(term) || String(c.number ?? "").includes(term);
    });
  }, [q, chapters]);

  /* actions */
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
        await supabase.from("bookmarks").delete().eq("novel_id", novelId).eq("user_id", session.user.id);
        setIsBookmarked(false);
        setBookmarkCount((c) => (typeof c === "number" ? Math.max(0, c - 1) : c));
      } else {
        await supabase.from("bookmarks").insert({ novel_id: novelId, user_id: session.user.id });
        setIsBookmarked(true);
        setBookmarkCount((c) => (typeof c === "number" ? c + 1 : c));
      }
    } finally {
      setBookmarkBusy(false);
    }
  }

  async function shareLink() {
    const url =
      typeof window !== "undefined"
        ? window.location.href
        : `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/novel/${params.slug}`;
    try {
      if ((navigator as any).share) await (navigator as any).share({ title: (novel as any)?.title, url });
      else await navigator.clipboard.writeText(url);
    } catch {}
  }

  function parseStoragePublicURL(u?: string | null) {
    if (!u) return null;
    const m = u.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: m[1], path: m[2] };
  }

  async function handleDeleteNovel() {
    if (!isOwner || !novel?.id) return;
    setDeletingNovel(true);
    setDeleteErr(null);
    try {
      const { error: rpcErr } = await supabase.rpc("delete_novel", { p_novel_id: (novel as any).id });
      if (rpcErr) {
        // fallback manual
        const { data: chIds } = await supabase.from("chapters").select("id").eq("novel_id", (novel as any).id);
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
        if (parsed) await supabase.storage.from(parsed.bucket).remove([parsed.path]);
      }
      window.location.href = "/profile";
    } catch (e: any) {
      setDeleteErr(e?.message ?? "Gagal menghapus novel.");
    } finally {
      setDeletingNovel(false);
    }
  }

  async function handleDeleteChapter(chId: string) {
    if (!isOwner) return;
    try {
      await supabase.from("chapters_comments").delete().eq("chapter_id", chId);
    } catch {}
    try {
      await supabase.from("chapters_reactions").delete().eq("chapter_id", chId);
    } catch {}
    await supabase.from("chapters").delete().eq("id", chId);
    setChapters((prev) => prev.filter((c: any) => c.id !== chId));
  }

  /* splash */
  if (showSplash) {
    return <LoadingSplash show title="Memuat halaman novel…" subtitle="Menyiapkan data & tampilan" blocking />;
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-zinc-950 text-zinc-100">
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
        </div>
      </div>
    );
  }

  if (!novel) {
    return (
      <div className="min-h-screen grid place-items-center bg-zinc-950 text-zinc-100">
        <div className="rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-3 text-sm">Novel tidak ditemukan.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(60%_60%_at_50%_0%,rgba(36,36,36,.6),rgba(12,12,12,1))] text-zinc-100">
      {/* Sticky top controls */}
      <div className="sticky top-0 z-40">
        <div className="mx-auto w-[min(1200px,94vw)] px-3 pt-3">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-900/60 px-2 py-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
            <button
              onClick={() => (history.length > 1 ? router.back() : (window.location.href = "/"))}
              className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 hover:bg-white/10"
              aria-label="Kembali"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Link href="/" className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 hover:bg-white/10" aria-label="Beranda">
              <HomeIcon className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto w-[min(1200px,94vw)] pb-28">
        {/* HERO */}
        <section className="relative mt-3 overflow-hidden rounded-3xl">
          {/* blurred backdrop */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              backgroundImage: `url(${cover})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
              filter: "blur(28px)",
              transform: "scale(1.12)",
              opacity: 0.35,
            }}
          />
          <div className="relative grid grid-cols-1 gap-6 border border-white/10 bg-white/5 p-5 backdrop-blur-xl md:grid-cols-[320px,1fr,340px] md:p-8">
            {/* cover */}
            <div>
              <img
                src={cover}
                alt={(novel as any).title}
                className="aspect-[3/4] w-full rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
              />
            </div>

            {/* main info */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                  {(novel as any).title}
                </h1>
                {typeof rating === "number" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-3 py-1 text-sm font-semibold text-amber-300 ring-1 ring-amber-300/40">
                    <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                    {rating.toFixed(1)}
                  </span>
                )}
                {isOwner && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-300/40">
                    <ShieldCheck className="h-4 w-4" />
                    Owner
                  </span>
                )}
              </div>
              <div className={clsx("mt-2 h-[2px] w-24 rounded-full bg-gradient-to-r", mainStyle.button)} />

              {/* chips */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  Status {(novel as any)?.status || "Ongoing"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  <BookOpen className="mr-1 inline h-4 w-4" /> {chapters.length} Bab
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
                  {tagsSafe.map((t) => {
                    const s = genreStyle(t);
                    return (
                      <span key={t} className={clsx("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1", s.chip)}>
                        <span className={clsx("h-1.5 w-1.5 rounded-full", s.dot)} />
                        {t}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* synopsis */}
              {!!(novel as any)?.synopsis && (
                <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-200/95">
                  {(novel as any).synopsis}
                </p>
              )}

              {/* actions */}
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={firstChapter ? `/read/${novel.slug}/${firstChapter.number}` : "#"}
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r px-4 py-2 text-sm font-semibold shadow-lg transition",
                    firstChapter ? mainStyle.button : "from-zinc-800 to-zinc-800 cursor-not-allowed opacity-60"
                  )}
                >
                  <BookOpen className="h-4 w-4" />
                  Mulai Baca
                </Link>

                <button
                  onClick={toggleBookmark}
                  disabled={bookmarkBusy || bookmarkCount == null}
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10",
                    isBookmarked && "ring-1 ring-emerald-400/40 bg-emerald-400/10"
                  )}
                >
                  <Bookmark className={clsx("h-4 w-4", isBookmarked && "fill-white")} />
                  {isBookmarked ? "Tersimpan" : "Bookmark"} {typeof bookmarkCount === "number" ? `(${bookmarkCount})` : ""}
                </button>

                <button
                  onClick={shareLink}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>

                {isOwner && (
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Link
                      href={`/novel/${novel.slug}/edit`}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit Novel
                    </Link>
                    <Link
                      href={`/novel/${novel.slug}/write`}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
                    >
                      <FilePlus2 className="h-4 w-4" />
                      Tambah Bab
                    </Link>
                    <button
                      onClick={() => {
                        setConfirmTitle("");
                        setAlsoDeleteCover(true);
                        setDeleteErr(null);
                        (document.getElementById("dlg-delete-novel") as HTMLDialogElement | null)?.showModal?.();
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-red-600/90 px-4 py-2 text-sm font-semibold transition hover:bg-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                      Hapus Novel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* aside */}
            <aside className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
              <div className="text-sm font-semibold">Author</div>
              <div className="mt-3 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-zinc-800 text-zinc-400">
                  {author?.avatar_url ? <img src={author.avatar_url} className="h-full w-full object-cover" alt="" /> : <span className="text-xs">avatar</span>}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{author?.username ?? "Unknown"}</div>
                  <div className="text-xs text-zinc-400">Bergabung {fmtDate(author?.created_at)}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                  <div className="text-xs text-zinc-400">Karya</div>
                  <div className="text-lg font-bold">{authorWorksCount ?? "—"}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                  <div className="text-xs text-zinc-400">Bookmark</div>
                  <div className="text-lg font-bold">{bookmarkCount ?? "—"}</div>
                </div>
              </div>

              {!!otherWorks.length && (
                <div className="mt-4">
                  <div className="mb-2 text-sm font-semibold">Karya lain</div>
                  <ul className="space-y-2">
                    {otherWorks.map((w) => (
                      <li key={w.id}>
                        <Link href={`/novel/${w.slug}`} className="flex items-center gap-2 rounded-lg p-2 hover:bg-white/5">
                          <div className="h-10 w-8 overflow-hidden rounded bg-zinc-800">
                            {w.cover_url ? <img src={w.cover_url} alt={w.title} className="h-full w-full object-cover" /> : null}
                          </div>
                          <div className="min-w-0 truncate text-sm">{w.title}</div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </section>

        {/* CHAPTER LIST */}
        <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold">
              Daftar Bab ({filtered.length}/{chapters.length})
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari bab (judul/nomor)…"
              className="h-9 w-[min(360px,80vw)] rounded-lg border border-white/10 bg-zinc-950/60 px-3 text-sm outline-none transition focus:ring-2 focus:ring-sky-600"
            />
          </div>

          <ul className="divide-y divide-white/10">
            {filtered.map((c: any) => (
              <li key={c.id} className="group grid grid-cols-[1fr,auto] items-center gap-2 px-4 py-3 transition hover:bg-white/5">
                <Link href={`/read/${(novel as any).slug}/${c.number}`} className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="rounded-md bg-zinc-900/50 px-2 py-0.5 text-xs ring-1 ring-white/10">Bab {c.number}</span>
                    <span className="truncate text-sm font-medium">{c.title || "Tanpa Judul"}</span>
                  </div>
                  {c.updated_at && <div className="mt-0.5 text-xs text-zinc-400">Update {fmtDate(c.updated_at)}</div>}
                </Link>

                {isOwner ? (
                  <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                    <Link
                      href={`/novel/${(novel as any).slug}/edit/${c.number}`}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                    >
                      <PencilLine className="mr-1 inline h-3.5 w-3.5" />
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDeleteChapter(c.id)}
                      className="rounded-lg bg-red-600/90 px-2 py-1 text-xs font-semibold hover:bg-red-600"
                    >
                      <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                      Hapus
                    </button>
                  </div>
                ) : (
                  <MoreVertical className="h-4 w-4 text-zinc-500" />
                )}
              </li>
            ))}

            {!filtered.length && (
              <li className="px-4 py-6 text-center text-sm text-zinc-400">Tidak ada bab yang cocok dengan pencarian.</li>
            )}
            {!chapters.length && (
              <li className="px-4 py-6 text-center text-sm text-zinc-400">
                Belum ada bab. {isOwner ? "Klik ‘Tambah Bab’ untuk mulai menulis." : ""}
              </li>
            )}
          </ul>
        </section>

        {/* COMMENTS (paling bawah) */}
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <MessageSquareIcon className="h-4 w-4" />
            Komentar
          </div>
          {firstChapter ? (
            <CommentsSection chapterId={String((firstChapter as any).id)} />
          ) : (
            <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-6 text-center text-sm text-zinc-400">
              Belum ada bab, jadi komentar belum tersedia.
            </div>
          )}
        </section>
      </main>

      <BottomBar />

      {/* DIALOG HAPUS NOVEL */}
      <dialog id="dlg-delete-novel" className="backdrop:bg-black/60 p-0 rounded-2xl">
        <form method="dialog" className="w-[min(520px,95vw)] rounded-2xl border border-white/10 bg-zinc-900 p-5 text-zinc-100">
          <h3 className="text-lg font-semibold">Hapus novel ini?</h3>
          <p className="mt-1 text-sm text-zinc-300">Tindakan ini akan menghapus <b>novel</b>, bab-babnya, dan data terkait.</p>

          <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            Ketik judul <b>“{(novel as any).title}”</b> untuk konfirmasi:
            <input
              value={confirmTitle}
              onChange={(e) => setConfirmTitle(e.target.value)}
              placeholder={(novel as any).title}
              className="mt-2 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-600"
            />
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={alsoDeleteCover} onChange={(e) => setAlsoDeleteCover(e.target.checked)} />
              Hapus juga cover dari Storage (jika dari Supabase Storage)
            </label>
          </div>

          {deleteErr && (
            <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{deleteErr}</div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => (document.getElementById("dlg-delete-novel") as HTMLDialogElement | null)?.close()}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
              disabled={deletingNovel}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleDeleteNovel}
              disabled={deletingNovel || confirmTitle.trim() !== (novel as any).title}
              className={clsx(
                "inline-flex items-center gap-2 rounded-lg bg-red-600/90 px-4 py-2 text-sm font-semibold hover:bg-red-600",
                (deletingNovel || confirmTitle.trim() !== (novel as any).title) && "cursor-not-allowed opacity-60"
              )}
            >
              {deletingNovel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deletingNovel ? "Menghapus…" : "Hapus"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
