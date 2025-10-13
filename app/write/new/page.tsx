import { Suspense } from "react";
import WriteChapterClient from "./_client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Memuat editor…</div>}>
      <WriteChapterClient />
    </Suspense>
  );
}
