"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  SendHorizontal,
  Loader2,
  SmilePlus,
  X,
  Reply,
  Edit2,
  Trash2,
  Pin,
  PinOff,
} from "lucide-react";
import clsx from "clsx";

/** ===== Types (DB tidak diubah) ===== */
type ReactionKind = "upvote" | "suki" | "apsih";

type CommentRow = {
  id: string;
  chapter_id: string;
  user_id: string | null;
  display_name: string | null;
  content: string;
  created_at: string;
  parent_id: string | null;
  kind?: "text" | "sticker" | null;
  sticker_url?: string | null;
};

type Counts = Record<ReactionKind, number>;

type Props = {
  chapterId: string;
  isAuthor?: boolean;
  maxLength?: number;
};

/** ===== Helpers kecil ===== */
function hashToIndex(s: string, mod: number) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}
function avatarGradient(name?: string | null) {
  const palettes = [
    "from-sky-600 to-cyan-500",
    "from-blue-600 to-sky-500",
    "from-indigo-600 to-sky-500",
    "from-cyan-600 to-teal-500",
    "from-sky-700 to-blue-500",
    "from-blue-700 to-indigo-500",
  ];
  const idx = hashToIndex((name || "guest").toLowerCase(), palettes.length);
  return `bg-gradient-to-br ${palettes[idx]}`;
}
const initial = (n?: string | null) =>
  ((n || "Guest").trim()[0] || "G").toUpperCase();

/** ===== Stickers di /public/stickers ===== */
const STICKERS = [
  { id: "think", url: "/stickers/yurathinking.png" },
  { id: "cry", url: "/stickers/yuracry.png" },
  { id: "fun", url: "/stickers/proudyura.png" },
  { id: "sad", url: "/stickers/sadyura.png" },
  { id: "derp", url: "/stickers/stupidyura.png" },
  { id: "yay", url: "/stickers/horeyura.png" },
];

/** ===== UI Reactions (map ke DB lama) ===== */
const UI_REACTIONS = [
  { ui: "Berpikir", img: "/stickers/yurathinking.png", db: "upvote" as ReactionKind },
  { ui: "Lucu", img: "/stickers/stupidyura.png", db: "suki" as ReactionKind },
  { ui: "Hore", img: "/stickers/horeyura.png", db: "apsih" as ReactionKind },
];

/** ===== Isi/pin util ===== */
const PIN_TAG = "[pin]";
const isPinned = (c: CommentRow) =>
  typeof c.content === "string" && c.content.startsWith(PIN_TAG);
const visibleText = (c: CommentRow) =>
  isPinned(c) ? c.content.slice(PIN_TAG.length) : c.content;

const isSticker = (c: CommentRow) =>
  c.kind === "sticker" ||
  !!c.sticker_url ||
  (typeof c.content === "string" && c.content.startsWith("[sticker]"));
const stickerUrl = (c: CommentRow) =>
  c.sticker_url || (c.content.startsWith("[sticker]") ? c.content.slice(9) : null);

/** ====== Komponen utama ====== */
export default function CommentsSection({
  chapterId,
  isAuthor = false,
  maxLength = 5000,
}: Props) {
  /** Auth */
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");

  /** State list */
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [order, setOrder] = useState<"new" | "old" | "top">("new");
  const [listLoading, setListLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE = 10;

  /** Input (root) */
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const remaining = maxLength - text.length;

  /** Reply & edit inline */
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  /** Stickers modal */
   const [pickerOpen, setPickerOpen] = useState<null | { parentId?: string }>(null);

  /** Reactions (tetap DB lama) */
  const [counts, setCounts] = useState<Counts>({
    upvote: 0,
    suki: 0,
    apsih: 0,
  });
  const [myReact, setMyReact] = useState<
    Partial<Record<ReactionKind, boolean>>
  >({});
  const [loadingReact, setLoadingReact] = useState<
    Partial<Record<ReactionKind, boolean>>
  >({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      setUserId(u?.id ?? null);
      setDisplayName(
        (u?.user_metadata?.name as string) ||
          (u?.user_metadata?.full_name as string) ||
          (u?.email as string) ||
          ""
      );
    })();
  }, []);

  /** Load comments + pagination */
  async function fetchPage(p = 0) {
    setListLoading(true);
    const from = p * PAGE;
    const to = from + PAGE - 1;

    const asc = order === "old";
    const query = supabase
      .from("chapters_comments")
      .select(
        "id,chapter_id,user_id,display_name,content,created_at,parent_id,kind,sticker_url"
      )
      .eq("chapter_id", chapterId)
      .order("created_at", { ascending: asc })
      .range(from, to);

    const { data, error } = await query;
    if (error) {
      setListLoading(false);
      return;
    }

    const merged =
      p === 0 ? (data as CommentRow[]) : [...comments, ...(data as CommentRow[])];

    const topSorted = (() => {
      if (order !== "top") return merged;
      const replyCount: Record<string, number> = {};
      merged.forEach((c) => {
        if (c.parent_id) replyCount[c.parent_id] = (replyCount[c.parent_id] || 0) + 1;
      });
      return [...merged].sort((a, b) => {
        const pinA = isPinned(a) ? 1 : 0;
        const pinB = isPinned(b) ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        if (a.parent_id || b.parent_id) return 0;
        return (replyCount[b.id] || 0) - (replyCount[a.id] || 0);
      });
    })();

    setComments(topSorted);
    setHasMore((data || []).length === PAGE);
    setListLoading(false);
  }

  async function loadReactions() {
    const { data } = await supabase
      .from("chapters_reactions")
      .select("kind,user_id")
      .eq("chapter_id", chapterId);

    const c: Counts = { upvote: 0, suki: 0, apsih: 0 };
    const mine: Partial<Record<ReactionKind, boolean>> = {};
    (data || []).forEach((r: any) => {
      if (r.kind in c) c[r.kind as ReactionKind] += 1;
      if (r.user_id === userId) mine[r.kind as ReactionKind] = true;
    });
    setCounts(c);
    setMyReact(mine);
  }

  useEffect(() => {
    setPage(0);
    fetchPage(0);
    loadReactions();

    const ch = supabase
      .channel(`comments_${chapterId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chapters_comments",
          filter: `chapter_id=eq.${chapterId}`,
        },
        () => fetchPage(0)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chapters_reactions",
          filter: `chapter_id=eq.${chapterId}`,
        },
        () => loadReactions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, userId, order]);

  /** CRUD text/sticker (root & reply) */
  async function createComment(payload: Partial<CommentRow>) {
    const { error } = await supabase
      .from("chapters_comments")
      .insert(payload);
    if (error) throw error;
  }

  async function submitRoot() {
    if (!text.trim()) return;
    if (text.length > maxLength) {
      setSubmitErr(`Maks ${maxLength} karakter.`);
      return;
    }
    setSending(true);
    setSubmitErr(null);
    try {
      await createComment({
        chapter_id: chapterId,
        content: text.trim(),
        user_id: userId,
        display_name: userId ? displayName || "User" : displayName || "Guest",
        parent_id: null,
        kind: "text",
      });
      setText("");
      fetchPage(0);
    } catch (e: any) {
      setSubmitErr(e?.message ?? "Gagal mengirim.");
    } finally {
      setSending(false);
    }
  }

  async function submitReply(parentId: string) {
    if (!replyText.trim()) return;
    setSending(true);
    setSubmitErr(null);
    try {
      await createComment({
        chapter_id: chapterId,
        content: replyText.trim(),
        user_id: userId,
        display_name: userId ? displayName || "User" : displayName || "Guest",
        parent_id: parentId,
        kind: "text",
      });
      setReplyFor(null);
      setReplyText("");
      fetchPage(0);
    } catch (e: any) {
      setSubmitErr(e?.message ?? "Gagal mengirim balasan.");
    } finally {
      setSending(false);
    }
  }

  async function sendSticker(url: string, parentId?: string) {
    setSending(true);
    setSubmitErr(null);
    try {
      await createComment({
        chapter_id: chapterId,
        user_id: userId,
        display_name: userId ? displayName || "User" : "Guest",
        parent_id: parentId ?? null,
        kind: "sticker",
        sticker_url: url,
        content: "[sticker]" + url,
      });
      setPickerOpen(null);
      fetchPage(0);
    } catch (e: any) {
      setSubmitErr(e?.message ?? "Gagal mengirim stiker.");
    } finally {
      setSending(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Hapus komentar ini?")) return;
    await supabase.from("chapters_comments").delete().eq("id", id);
    fetchPage(0);
  }

  async function onEditSave(id: string) {
    if (!editText.trim()) return setEditingId(null);
    const { error } = await supabase
      .from("chapters_comments")
      .update({ content: editText, kind: "text", sticker_url: null })
      .eq("id", id);
    if (error) alert(error.message);
    setEditingId(null);
    fetchPage(0);
  }

  /** Pin (maks 1, only author). Simpan tag "[pin]" di content */
  async function pinToggle(target: CommentRow) {
    if (!isAuthor) return;
    const currentPinned = comments.filter(
      (c) => isPinned(c) && c.parent_id === null
    );
    for (const c of currentPinned) {
      await supabase
        .from("chapters_comments")
        .update({ content: visibleText(c) })
        .eq("id", c.id);
    }
    if (!isPinned(target)) {
      await supabase
        .from("chapters_comments")
        .update({ content: PIN_TAG + visibleText(target) })
        .eq("id", target.id);
    }
    fetchPage(0);
  }

  /** Reactions */
  async function toggleReaction(kind: ReactionKind) {
    if (!userId) {
      await supabase.auth.signInWithOAuth({ provider: "google" });
      return;
    }
    setLoadingReact((s) => ({ ...s, [kind]: true }));
    try {
      if (myReact[kind]) {
        await supabase
          .from("chapters_reactions")
          .delete()
          .eq("chapter_id", chapterId)
          .eq("user_id", userId)
          .eq("kind", kind);
      } else {
        await supabase
          .from("chapters_reactions")
          .insert({ chapter_id: chapterId, user_id: userId, kind });
      }
      await loadReactions();
    } finally {
      setLoadingReact((s) => ({ ...s, [kind]: false }));
    }
  }

  /** Derivations */
  const rootComments = useMemo(
    () => comments.filter((c) => c.parent_id === null),
    [comments]
  );
  const repliesByParent = useMemo(() => {
    const map: Record<string, CommentRow[]> = {};
    comments.forEach((c) => {
      if (!c.parent_id) return;
      (map[c.parent_id] ||= []).push(c);
    });
    return map;
  }, [comments]);

  /** UI **/
  return (
    <section className="mt-8">
      {/* REACTIONS */}
      <div className="text-center">
        <h3 className="text-xl font-extrabold tracking-wide sm:text-2xl md:text-3xl">
          Reaksi
        </h3>
        <p className="mt-1 text-sm opacity-80 sm:text-base md:text-lg">
          {counts.upvote + counts.suki + counts.apsih} total reaksi
        </p>

        <div className="mt-5 flex flex-wrap items-end justify-center gap-5 sm:gap-7 md:gap-10">
          {UI_REACTIONS.map(({ ui, img, db }) => (
            <ReactionButton
              key={ui}
              label={ui}
              imgSrc={img}
              active={!!myReact[db]}
              count={counts[db]}
              busy={!!loadingReact[db]}
              onClick={() => toggleReaction(db)}
            />
          ))}
        </div>
      </div>

      {/* INPUT ROOT */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/40 p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs opacity-70 sm:text-sm">
            {userId ? (
              <>
                Masuk sebagai{" "}
                <span className="font-semibold">{displayName || "User"}</span>
              </>
            ) : (
              <>
                Tulis komentar sebagai{" "}
                <span className="font-semibold">Guest</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs opacity-60">
            {Math.max(0, text.trim().split(/\s+/).filter(Boolean).length)} kata ·{" "}
            {remaining} chars
          </div>
        </div>

        {/* Stack di mobile, grid di md+ */}
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <textarea
            className="h-28 w-full resize-y rounded-lg border border-white/10 bg-zinc-950 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-600"
            placeholder="Komen di mari…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={maxLength + 1000}
          />
          <div className="flex flex-row gap-2 md:flex-col">
            <button
              type="button"
              onClick={() => setPickerOpen({})}
              className="inline-flex w-1/2 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700 md:w-auto"
            >
              <SmilePlus className="h-4 w-4" /> Stiker
            </button>
            <button
              onClick={submitRoot}
              disabled={!text.trim() || sending || remaining < 0}
              className={clsx(
                "inline-flex w-1/2 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm md:w-auto",
                !text.trim() || remaining < 0
                  ? "bg-zinc-800 opacity-60"
                  : "bg-sky-600 hover:bg-sky-500"
              )}
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengirim…
                </>
              ) : (
                <>
                  <SendHorizontal className="h-4 w-4" />
                  Kirim
                </>
              )}
            </button>
          </div>
        </div>

        {submitErr && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {submitErr}
          </div>
        )}
      </div>

      {/* SORT + LIST */}
      <div className="mt-6">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-base font-semibold sm:text-lg">
            {comments.length} Komentar
          </div>
          <div className="flex gap-2">
            {[
              { id: "new", label: "Terbaru" },
              { id: "old", label: "Terlama" },
              { id: "top", label: "Terpopuler" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setOrder(s.id as any)}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs sm:text-sm",
                  order === (s.id as any) ? "bg-zinc-800" : "bg-zinc-900"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {listLoading && page === 0 ? (
          <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-6 text-center text-sm opacity-70">
            Memuat komentar…
          </div>
        ) : (
          <div className="space-y-4">
            {rootComments.map((c) => (
              <div
                key={c.id}
                className={clsx(
                  "rounded-xl border border-white/10 bg-zinc-900/40 p-3 sm:p-4",
                  isPinned(c) && "ring-2 ring-sky-500/60"
                )}
              >
                {/* header */}
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <div
                      className={clsx(
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold uppercase text-white sm:h-8 sm:w-8 sm:text-sm",
                        avatarGradient(c.display_name)
                      )}
                    >
                      {initial(c.display_name)}
                    </div>
                    <div>
                      <div className="font-semibold">
                        {c.display_name || "Guest"}
                      </div>
                      <div className="text-[11px] opacity-60 sm:text-xs">
                        {new Date(c.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {isAuthor && c.parent_id === null && (
                      <button
                        onClick={() => pinToggle(c)}
                        className="rounded-md bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                        title={isPinned(c) ? "Lepas sematan" : "Sematkan"}
                      >
                        {isPinned(c) ? (
                          <PinOff className="h-4 w-4" />
                        ) : (
                          <Pin className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    {((userId && userId === c.user_id) || isAuthor) && (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(c.id);
                            setEditText(visibleText(c));
                          }}
                          className="rounded-md bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(c.id)}
                          className="rounded-md bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setReplyFor(c.id)}
                      className="rounded-md bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                      title="Balas"
                    >
                      <Reply className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* body: edit / isi */}
                {editingId === c.id ? (
                  <div className="space-y-2">
                    <textarea
                      className="h-24 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-600"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => onEditSave(c.id)}
                        className="rounded-lg bg-sky-600 px-3 py-1 text-sm hover:bg-sky-500"
                      >
                        Simpan
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg bg-zinc-800 px-3 py-1 text-sm"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : isSticker(c) ? (
                  <img
                    src={stickerUrl(c)!}
                    alt="stiker"
                    className="max-h-40 select-none sm:max-h-48"
                    draggable={false}
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-7 sm:text-base">
                    {visibleText(c)}
                  </div>
                )}

                {/* replies */}
                <div className="mt-3 space-y-2">
                  {(repliesByParent[c.id] || []).map((r) => (
                    <div
                      key={r.id}
                      className="ml-3 rounded-lg border border-white/10 bg-white/5 p-3 sm:ml-6 md:ml-10"
                    >
                      <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <div
                            className={clsx(
                              "grid h-6 w-6 place-items-center rounded-full text-[11px] text-white sm:h-7 sm:w-7 sm:text-xs",
                              avatarGradient(r.display_name)
                            )}
                          >
                            {initial(r.display_name)}
                          </div>
                          <div className="font-semibold">
                            {r.display_name || "Guest"}
                          </div>
                          <div className="opacity-60">
                            · {new Date(r.created_at).toLocaleString()}
                          </div>
                        </div>
                        {((userId && userId === r.user_id) || isAuthor) && (
                          <div className="mt-1 flex gap-1 sm:mt-0">
                            <button
                              onClick={() => {
                                setEditingId(r.id);
                                setEditText(visibleText(r));
                              }}
                              className="rounded-md bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => onDelete(r.id)}
                              className="rounded-md bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {editingId === r.id ? (
                        <div className="space-y-2">
                          <textarea
                            className="h-20 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-600"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => onEditSave(r.id)}
                              className="rounded-lg bg-sky-600 px-3 py-1 text-sm hover:bg-sky-500"
                            >
                              Simpan
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded-lg bg-zinc-800 px-3 py-1 text-sm"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : isSticker(r) ? (
                        <img
                          src={stickerUrl(r)!}
                          alt="stiker"
                          className="max-h-32 select-none sm:max-h-40"
                          draggable={false}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap text-sm leading-7">
                          {visibleText(r)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* reply editor */}
                {replyFor === c.id && (
                  <div className="ml-3 mt-3 space-y-2 sm:ml-6 md:ml-10">
                    <textarea
                      className="h-20 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-600"
                      placeholder="Tulis balasan…"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => submitReply(c.id)}
                        className="rounded-lg bg-sky-600 px-3 py-1 text-sm hover:bg-sky-500"
                      >
                        Balas
                      </button>
                      <button
                        onClick={() => setPickerOpen({ parentId: c.id })}
                        className="rounded-lg bg-zinc-800 px-3 py-1 text-sm"
                      >
                        <SmilePlus className="mr-1 inline h-4 w-4" />
                        Stiker
                      </button>
                      <button
                        onClick={() => {
                          setReplyFor(null);
                          setReplyText("");
                        }}
                        className="rounded-lg bg-zinc-800 px-3 py-1 text-sm"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="pt-2">
                <button
                  onClick={() => {
                    const np = page + 1;
                    setPage(np);
                    fetchPage(np);
                  }}
                  className="mx-auto block rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                >
                  Tampilkan lebih banyak
                </button>
              </div>
            )}

            {!listLoading && rootComments.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-6 text-center text-sm opacity-70">
                Belum ada komentar. Jadilah yang pertama!
              </div>
            )}
          </div>
        )}
      </div>

      {/* STICKER MODAL */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-[min(680px,92vw)] rounded-2xl border border-white/10 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Pilih Stiker</div>
              <button
                onClick={() => setPickerOpen(null)}
                className="rounded-lg bg-zinc-800 px-2 py-1 hover:bg-zinc-700"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {STICKERS.map((s) => (
                <button
                  key={s.id}
                  onClick={() =>
                    sendSticker(s.url, pickerOpen?.parentId ?? undefined)
                  }
                  className="group rounded-xl border border-white/10 bg-zinc-800/50 p-2 hover:bg-zinc-800"
                >
                  <img
                    src={s.url}
                    alt={s.id}
                    className="mx-auto h-20 object-contain transition-transform group-hover:scale-105 sm:h-24"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** ==== Tombol Reaksi: lebih kecil di mobile ==== */
function ReactionButton({
  label,
  imgSrc,
  active,
  count,
  busy,
  onClick,
}: {
  label: string;
  imgSrc: string;
  active?: boolean;
  count?: number;
  busy?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center"
    >
      {/* badge jumlah */}
      <span
        className={clsx(
          "absolute -right-2.5 -top-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-sky-700 sm:-right-3 sm:text-xs",
          active ? "bg-sky-600" : "bg-zinc-800"
        )}
      >
        {busy ? "…" : count ?? 0}
      </span>

      {/* Lingkaran gambar dengan ukuran responsif */}
      <div
        className={clsx(
          "overflow-hidden rounded-full ring-1 ring-white/10",
          // ukuran: mobile kecil → tablet sedang → desktop besar
          "h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20",
          active ? "bg-sky-600/20" : "bg-zinc-800/50"
        )}
      >
        <img
          src={imgSrc}
          alt={label}
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>

      <div className="mt-2 text-xs font-semibold sm:text-sm md:text-base">
        {label}
      </div>
    </button>
  );
}
