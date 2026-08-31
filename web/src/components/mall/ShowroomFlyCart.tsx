"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { addToCart } from "@/lib/cart";
import type { Product } from "@/lib/types";

type Origin = { x: number; y: number; width: number; height: number };

type FlyJob = {
  id: string;
  image?: string;
  origin: Origin;
  target: { x: number; y: number };
};

type Ctx = {
  flyAdd: (product: Product, origin: Origin) => void;
  registerBagTarget: (el: HTMLElement | null) => void;
  bagPulse: number;
};

const FlyCartContext = createContext<Ctx | null>(null);

export function useShowroomFlyCart() {
  return useContext(FlyCartContext);
}

export function ShowroomFlyCartProvider({ children }: { children: ReactNode }) {
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const [jobs, setJobs] = useState<FlyJob[]>([]);
  const [bagPulse, setBagPulse] = useState(0);

  const registerBagTarget = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    targetRef.current = {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
    };
  }, []);

  const flyAdd = useCallback((product: Product, origin: Origin) => {
    try {
      addToCart(product);
    } catch {
      /* still animate */
    }

    const target =
      targetRef.current ||
      (typeof window !== "undefined"
        ? { x: window.innerWidth - 48, y: 40 }
        : { x: 0, y: 0 });

    const id = `${product._id}-${Date.now()}`;
    setJobs((prev) => [
      ...prev,
      {
        id,
        image: product.images?.[0],
        origin,
        target,
      },
    ]);
  }, []);

  const onDone = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setBagPulse((n) => n + 1);
  }, []);

  return (
    <FlyCartContext.Provider value={{ flyAdd, registerBagTarget, bagPulse }}>
      {children}
      {jobs.map((job) => (
        <FlyParticle key={job.id} job={job} onDone={() => onDone(job.id)} />
      ))}
    </FlyCartContext.Provider>
  );
}

function FlyParticle({
  job,
  onDone,
}: {
  job: FlyJob;
  onDone: () => void;
}) {
  const [style, setStyle] = useState<React.CSSProperties>({
    left: job.origin.x + job.origin.width / 2 - 22,
    top: job.origin.y + job.origin.height / 2 - 22,
    opacity: 1,
    transform: "scale(1)",
  });

  useEffect(() => {
    const t0 = requestAnimationFrame(() => {
      setStyle({
        left: job.target.x - 14,
        top: job.target.y - 14,
        opacity: 0.35,
        transform: "scale(0.35)",
        transition:
          "left 0.62s cubic-bezier(0.22, 1, 0.36, 1), top 0.62s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.62s ease, transform 0.62s ease",
      });
    });
    const done = window.setTimeout(onDone, 640);
    return () => {
      cancelAnimationFrame(t0);
      clearTimeout(done);
    };
  }, [job, onDone]);

  return (
    <div
      className="pointer-events-none fixed z-[80] h-11 w-11 overflow-hidden rounded-full border border-white/20 bg-surface shadow-lg"
      style={style}
    >
      {job.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={job.image} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-surface-2" />
      )}
    </div>
  );
}