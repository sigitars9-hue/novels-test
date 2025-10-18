// lib/genreStyles.ts
type Style = {
  chip: string;     // ring + bg + text utk tag/chip
  dot: string;      // titik aksen kecil
  button: string;   // gradient utk tombol utama
};

export const GENRE_STYLES: Record<string, Style> = {
  Romance: {
    chip: "ring-rose-400/30 bg-rose-500/15 text-rose-200",
    dot: "bg-rose-400",
    button: "from-rose-500 to-fuchsia-500 hover:from-rose-400 hover:to-fuchsia-400",
  },
  Comedy: {
    chip: "ring-amber-400/30 bg-amber-500/15 text-amber-200",
    dot: "bg-amber-400",
    button: "from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400",
  },
  "Slice of Life": {
    chip: "ring-emerald-400/30 bg-emerald-500/15 text-emerald-200",
    dot: "bg-emerald-400",
    button: "from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400",
  },
  Fantasy: {
    chip: "ring-violet-400/30 bg-violet-500/15 text-violet-200",
    dot: "bg-violet-400",
    button: "from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400",
  },
  Action: {
    chip: "ring-red-400/30 bg-red-500/15 text-red-200",
    dot: "bg-red-400",
    button: "from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500",
  },
  Drama: {
    chip: "ring-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-200",
    dot: "bg-fuchsia-400",
    button: "from-fuchsia-500 to-pink-500 hover:from-fuchsia-400 hover:to-pink-400",
  },
  Horror: {
    chip: "ring-slate-300/30 bg-slate-200/10 text-slate-200",
    dot: "bg-slate-200",
    button: "from-slate-600 to-zinc-700 hover:from-slate-500 hover:to-zinc-600",
  },
  "Sci-Fi": {
    chip: "ring-cyan-400/30 bg-cyan-500/15 text-cyan-200",
    dot: "bg-cyan-400",
    button: "from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400",
  },
  Mystery: {
    chip: "ring-indigo-400/30 bg-indigo-500/15 text-indigo-200",
    dot: "bg-indigo-400",
    button: "from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400",
  },
  Adventure: {
    chip: "ring-lime-400/30 bg-lime-500/15 text-lime-200",
    dot: "bg-lime-400",
    button: "from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400",
  },
  Thriller: {
    chip: "ring-orange-400/30 bg-orange-500/15 text-orange-200",
    dot: "bg-orange-400",
    button: "from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500",
  },
  Sports: {
    chip: "ring-sky-400/30 bg-sky-500/15 text-sky-200",
    dot: "bg-sky-400",
    button: "from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400",
  },
  Isekai: {
    chip: "ring-purple-400/30 bg-purple-500/15 text-purple-200",
    dot: "bg-purple-400",
    button: "from-purple-500 to-rose-500 hover:from-purple-400 hover:to-rose-400",
  },
  Historical: {
    chip: "ring-amber-300/30 bg-amber-300/15 text-amber-200",
    dot: "bg-amber-300",
    button: "from-amber-600 to-stone-500 hover:from-amber-500 hover:to-stone-400",
  },
};

const DEFAULT_STYLE: Style = {
  chip: "ring-white/15 bg-white/10 text-zinc-200",
  dot: "bg-zinc-300",
  button: "from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500",
};

export function genreStyle(genre?: string): Style {
  return GENRE_STYLES[genre ?? ""] ?? DEFAULT_STYLE;
}
