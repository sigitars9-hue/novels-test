// src/components/MarkdownView.tsx
"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import DOMPurify from "dompurify";

type Props = {
  content: string | null | undefined;
  className?: string;
};

/**
 * Jika content berisi tag HTML (mis. <p>, <strong>), kita anggap HTML.
 * Jika tidak, kita render sebagai Markdown.
 */
function looksLikeHTML(s: string) {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

export default function MarkdownView({ content, className = "" }: Props) {
  const safe = content ?? "";

  if (!safe) {
    return <div className={className}>—</div>;
  }

  // Mode HTML (misal editor menyimpan <p>...</p>)
  if (looksLikeHTML(safe)) {
    const sanitized = DOMPurify.sanitize(safe);
    return (
      <div
        className={`prose prose-zinc dark:prose-invert max-w-none ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  // Mode Markdown
  return (
    <div className={`prose prose-zinc dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]} // izinkan HTML inline tapi tetap disterilkan
      >
        {safe}
      </ReactMarkdown>
    </div>
  );
}
