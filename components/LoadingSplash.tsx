"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export default function LoadingSplash({
  show,
  title = "Mempersiapkan konten",
  subtitle = "Memuat data dari server…",
  blocking = true,
}: {
  show: boolean;
  title?: string;
  subtitle?: string;
  blocking?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const arcsRef = useRef<(SVGCircleElement | null)[]>([]);
  const cleanupRef = useRef<(() => void) | null>(null);

  const [rendered, setRendered] = useState(show);
  const HIDE_DELAY = 220;

  // 1) Efek untuk gate render (SELALU dipanggil)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (show) setRendered(true);
    else t = setTimeout(() => setRendered(false), HIDE_DELAY);
    return () => t && clearTimeout(t);
  }, [show]);

useEffect(() => {
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (!rendered || !show || reduce) return;

  const arcs = (arcsRef.current || []).filter(
    (el): el is SVGCircleElement => !!el
  );
  if (!svgRef.current || arcs.length === 0) return;

  let spinInst: any;
  let dashInst: any;
  let glowInst: any;
  let disposed = false;

  const loadAnime = async () => {
    // 1) muat modul
    let mod: any = null;
    try {
      mod = await import("animejs"); // jangan subpath
    } catch {
      mod = null;
    }

    // 2) ambil fungsi anime dari berbagai kemungkinan bentuk ekspor
    let animeFn: any = null;
    if (typeof mod === "function") animeFn = mod;
    else if (mod) {
      if (typeof mod.default === "function") animeFn = mod.default;
      else if (typeof mod.anime === "function") animeFn = mod.anime;
      else if (mod.default && typeof mod.default.anime === "function")
        animeFn = mod.default.anime;
    }

    return animeFn;
  };

  (async () => {
    const anime = await loadAnime();

    if (disposed) return;

    if (typeof anime !== "function") {
      // Fallback aman: pakai CSS animate-spin supaya tidak crash
      svgRef.current?.classList.add("animate-spin");
      return;
    }

    // ——— pakai animejs ———
    spinInst = anime({
      targets: svgRef.current,
      rotate: "360deg",
      duration: 2200,
      easing: "linear",
      loop: true,
      autoplay: true,
    });

    dashInst = anime({
      targets: arcs,
      strokeDasharray: ["1 180", "90 180", "1 180"],
      strokeDashoffset: [0, -120, -260],
      duration: 1200,
      delay: anime.stagger(140),
      easing: "easeInOutSine",
      direction: "alternate",
      loop: true,
      autoplay: true,
    });

    glowInst = anime({
      targets: svgRef.current,
      opacity: [{ value: 0.85, duration: 500 }, { value: 1, duration: 600 }],
      easing: "easeInOutSine",
      loop: true,
      autoplay: true,
    });
  })();

  return () => {
    disposed = true;
    svgRef.current?.classList.remove("animate-spin"); // bersihkan fallback
    spinInst?.pause();
    dashInst?.pause();
    glowInst?.pause();
  };
}, [rendered, show]);


  // ❗️Return null DIPINDAH KE BAWAH, setelah semua hooks dipanggil
  if (!rendered) return null;

  const setArcRef = (i: number) => (el: SVGCircleElement | null) => {
    arcsRef.current[i] = el;
  };

  return (
    <div
      aria-hidden={!show}
      className={clsx(
        "fixed inset-0 z-[80] transition-opacity duration-200",
        show ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
    >
      <div
        className={clsx(
          "absolute inset-0 bg-black/60 backdrop-blur-sm",
          blocking ? "pointer-events-auto" : "pointer-events-none"
        )}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-[min(420px,92vw)] rounded-2xl border border-white/10 bg-zinc-950/90 px-6 py-6 text-center shadow-2xl ring-1 ring-white/10">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-white/5">
            <svg
              ref={svgRef}
              viewBox="0 0 100 100"
              className="h-10 w-10 text-sky-300 drop-shadow-[0_0_16px_rgba(56,189,248,0.35)]"
              style={{ transformOrigin: "50% 50%" }}
              aria-hidden="true"
            >
              <circle
                cx="50"
                cy="50"
                r="37"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.25"
                strokeWidth="5"
              />
              <circle
                ref={setArcRef(0)}
                cx="50"
                cy="50"
                r="30"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="1 180"
                className="opacity-90"
              />
              <circle
                ref={setArcRef(1)}
                cx="50"
                cy="50"
                r="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="1 180"
                className="opacity-80"
              />
              <circle
                ref={setArcRef(2)}
                cx="50"
                cy="50"
                r="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="1 160"
                className="opacity-75"
              />
            </svg>
          </div>

          <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
          <p className="mt-1 text-sm text-zinc-300">{subtitle}</p>
          <div className="sr-only" aria-live="assertive" role="status">
            {title} — {subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}
