"use client";
import React, { useRef } from "react";

// GANTI fungsi lama ini
export function mdToHtml(src: string): string {
  if (!src) return "";

  // escape HTML dulu
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // normalisasi newline
  const text = src.replace(/\r\n/g, "\n").trim();

  // pecah menjadi blok berdasarkan 1+ baris kosong
  const blocks = text.split(/\n{2,}/);

  const htmlBlocks = blocks.map((raw) => {
    let s = esc(raw).trim();

    // --- Heading di baris yang sama ---
    if (/^#{1,6}\s+/.test(s)) {
      const m = s.match(/^(#{1,6})\s+(.+)$/)!;
      const level = Math.min(6, m[1].length);
      const body = m[2];
      const hCls =
        level === 1
          ? "text-2xl font-bold mt-6 mb-4"
          : level === 2
          ? "text-xl font-bold mt-5 mb-3"
          : "text-lg font-semibold mt-4 mb-2";
      return `<h${level} class="${hCls}">${body}</h${level}>`;
    }

    // --- inline formatting ---
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
    s = s.replace(
      /!\[(.*?)\]\((.*?)\)/g,
      '<img src="$2" alt="$1" class="my-3 rounded border border-white/10 max-w-full" />'
    );

    // satu newline = <br>, lalu bungkus <p>
    s = s.replace(/\n/g, "<br>");
    return `<p>${s}</p>`;
  });

  return htmlBlocks.join("");
}


/* ---------- Tombol toolbar ---------- */
function ToolbarButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
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

/* ---------- Editor (textarea + toolbar + preview) ---------- */
export default function Editor({
  value,
  setValue,
}: {
  value: string;
  setValue: (v: string) => void; // <- HANYA string, tidak pernah function
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  /** Sisipkan pembungkus di area terpilih */
  function wrapSelection(before: string, after: string) {
    const el = taRef.current;
    if (!el) return;

    const s = el.selectionStart ?? 0;
    const e = el.selectionEnd ?? 0;
    const cur = value ?? "";
    const selected = cur.slice(s, e);

    const out = cur.slice(0, s) + before + selected + after + cur.slice(e);
    setValue(out); // <- langsung string

    // kembalikan fokus & selection
    requestAnimationFrame(() => {
      el.focus();
      const caretStart = s + before.length;
      const caretEnd = e + before.length;
      el.setSelectionRange(caretStart, caretEnd);
    });
  }

  /** Sisipkan heading di baris baru */
  function insertHeading(level: number) {
    const hashes = "#".repeat(Math.max(1, Math.min(6, level))) + " ";
    wrapSelection("\n" + hashes, "");
  }

  /** Sisipkan gambar (URL) */
  function insertImage() {
    const url = window.prompt("Masukkan URL gambar (boleh data URL):");
    if (!url) return;
    setValue((value || "") + `\n![image](${url})\n`);
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <ToolbarButton onClick={() => insertHeading(1)}>H1</ToolbarButton>
        <ToolbarButton onClick={() => insertHeading(2)}>H2</ToolbarButton>
        <ToolbarButton onClick={() => insertHeading(3)}>H3</ToolbarButton>
        <ToolbarButton onClick={() => wrapSelection("**", "**")}>Bold</ToolbarButton>
        <ToolbarButton onClick={() => wrapSelection("*", "*")}>Italic</ToolbarButton>
        <ToolbarButton onClick={insertImage}>Insert img</ToolbarButton>
      </div>

      {/* Textarea input */}
      <textarea
        ref={taRef}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm h-56"
        placeholder="Tulis konten bab di sini... (Markdown dasar: #, ##, ###, **bold**, *italic*, ![alt](url))"
      />

      {/* Preview */}
      <div className="rounded-xl border border-white/10 p-3" style={{ background: "var(--card)" }}>
        <div className="text-xs text-[color:var(--muted)] mb-2">Preview</div>
        <div
          className="prose prose-invert max-w-none"
          // Preview aman—kita hanya render hasil mdToHtml ringan di atas
          dangerouslySetInnerHTML={{ __html: mdToHtml(value || "") }}
        />
      </div>
    </div>
  );
}
