import { Suspense } from "react";
import CallbackClient from "./_client";  // pastikan nama & path sama

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AuthCallbackPage() {
  return (
    <div className="mx-auto w-[min(680px,92vw)] py-10">
      <Suspense
        fallback={
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
            Memproses login…
          </div>
        }
      >
        <CallbackClient />
      </Suspense>
    </div>
  );
}
