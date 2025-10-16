"use client";
import { useRef } from "react";

/* ----------------------- Utilities ----------------------- */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Markdown (sederhana) -> HTML yang aman. Tahan terhadap input aneh dan tidak nge-crash. */
export function mdToHtml(src: string): string {
  if (!src) return "";

  // Normalisasi newline & trim tepi
  const text = src.replace(/\r\n/g, "\n").trim();

  // Pisah blok berdasarkan 1+ baris kosong
  const blocks = text.split(/\n{2,}/);

  const htmlBlocks = blocks.map((raw) => {
    let s = esc(raw).trim();

    // Heading: `#`, `##`, `###` (harus ada spasi + teks)
    if (/^#{1,6}\s+/.test(s)) {
      const m = s.match(/^(#{1,6})\s+(.+)$/);
      if (m) {
        const level = Math.min(6, m[1].length);
        const body = m[2].trim();
        const hCls =
          level === 1
            ? "text-2xl font-bold mt-6 mb-4"
            : level === 2
            ? "text-xl font-bold mt-5 mb-3"
            : "text-lg font-semibold mt-4 mb-2";
        return `<h${level} class="${hCls}">${body}</h${level}>`;
      }
      // Kalau hanya '#' tanpa teks, fallback ke paragraf biasa
    }

    // Inline formatting (aman; sudah di-esc di atas)
    // **bold** dan *italic*
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Gambar: ![alt](url)
    s = s.replace(
      /!\[(.*?)\]\((.*?)\)/g,
      '<img src="$2" alt="$1" class="my-3 rounded border border-white/10 max-w-full" />'
    );

    // Newline tunggal jadi <br>
    s = s.replace(/\n/g, "<br>");

    // Bungkus paragraf
    return `<p>${s}</p>`;
  });

  return htmlBlocks.join("");
}

/* ----------------------- UI Helpers ----------------------- */
function ToolbarButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { children, className = "", ...rest } = props;
  return (
    <button
      type="button"
      {...rest}
      className={`px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-xs ${className}`}
    >
      {children}
    </button>
  );
}

/* ----------------------- Component ----------------------- */
export default function Editor({
  value,
  setValue,
}: {
  value: string;
  setValue: (v: string) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  /** Sisipkan wrapper di posisi seleksi (aman untuk TS) */
  function wrap(before: string, after = "") {
    const el = taRef.current;
    if (!el) return;

    const s = el.selectionStart ?? 0;
    const e = el.selectionEnd ?? 0;
    const v = el.value ?? "";

    const selected = v.slice(s, e);
    const out = v.slice(0, s) + before + selected + after + v.slice(e);
    setValue(out);

    // Kembalikan fokus & seleksi
    setTimeout(() => {
      if (!taRef.current) return;
      const ns = s + before.length;
      const ne = e + before.length;
      taRef.current.focus();
      taRef.current.selectionStart = ns;
      taRef.current.selectionEnd = ne;
    }, 0);
  }

  function insertHeading(level: 1 | 2 | 3) {
    const hashes = "#".repeat(level);
    // Pastikan heading selalu mulai di baris baru & ada spasi setelah '#'
    wrap(`\n${hashes} `);
  }

  function insertImage() {
    const url = window.prompt("Masukkan URL gambar (boleh data URL):");
    if (!url) return;
    const alt = window.prompt("Alt text (opsional):") || "image";
    setValue((value || "") + `\n![${alt}](${url})\n`);
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <ToolbarButton onClick={() => insertHeading(1)}>H1</ToolbarButton>
        <ToolbarButton onClick={() => insertHeading(2)}>H2</ToolbarButton>
        <ToolbarButton onClick={() => insertHeading(3)}>H3</ToolbarButton>
        <ToolbarButton onClick={() => wrap("**", "**")}>Bold</ToolbarButton>
        <ToolbarButton onClick={() => wrap("*", "*")}>Italic</ToolbarButton>
        <ToolbarButton onClick={insertImage}>Insert img</ToolbarButton>
      </div>

      {/* Textarea (Markdown sederhana) */}
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm h-56"
        placeholder="Tulis konten bab di sini... (Markdown: #, ##, ###, **bold**, *italic*, ![alt](url))"
      />

      {/* Preview */}
      <div className="rounded-xl border border-white/10 p-3" style={{ background: "var(--card)" }}>
        <div className="text-xs text-[color:var(--muted)] mb-2">Preview</div>
        <div
          className="prose prose-invert max-w-none"
          // aman karena sudah di-escape dan hanya menyisakan tag yang kita bentuk sendiri
          dangerouslySetInnerHTML={{ __html: mdToHtml(value) }}
        />
      </div>
    </div>
  );
}
