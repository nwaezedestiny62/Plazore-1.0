"use client";

export function OrbLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative h-14 w-14">
        <div
          className="absolute inset-0 rounded-full opacity-40"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, #5CFFB0 0%, #00E575 45%, transparent 70%)",
            filter: "blur(6px)",
            animation: "plazore-orb-pulse 1.8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute inset-1 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 32% 28%, #B8FFE0 0%, #00E575 40%, #0A3D2C 78%, #041412 100%)",
            boxShadow:
              "0 0 24px rgba(0, 229, 117, 0.35), inset 0 0 12px rgba(255,255,255,0.12)",
            animation: "plazore-orb-spin 3.2s linear infinite",
          }}
        />
        <div
          className="absolute inset-[18%] rounded-full opacity-70"
          style={{
            background:
              "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.55) 0%, transparent 55%)",
          }}
        />
      </div>
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#737A86]">
        {label}
      </p>
      <style jsx>{`
        @keyframes plazore-orb-pulse {
          0%,
          100% {
            transform: scale(0.92);
            opacity: 0.35;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.55;
          }
        }
        @keyframes plazore-orb-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}