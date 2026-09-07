"use client";

import { Poppins } from "next/font/google";
import { Music2 } from "lucide-react";
import { Panel, cn } from "@/components/ui";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/**
 * /experience — Music / sensory layer only.
 * Hero banners live exclusively under /content.
 */
export default function ExperiencePage() {
  return (
    <div className={cn(poppins.className, "space-y-6")}>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
          Experience
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#F5F7FA]">
          Ambient Soundtrack
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[#A7ADB8]">
          Music is managed via Supabase Storage (bucket{" "}
          <code className="text-[#00E575]">soundtrack</code>). It is not part of
          the Hero Banner system. Users control playback from Settings — off by
          default.
        </p>
      </div>

      <Panel className="p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 items-center justify-center border border-[#252A33] bg-[#171B22]">
            <Music2 className="h-5 w-5 text-[#00E575]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-[#F5F7FA]">Supabase library</p>
            <p className="mt-1 text-sm text-[#A7ADB8]">
              Upload and organize tracks in the Supabase dashboard under the{" "}
              <strong className="text-[#F5F7FA]">soundtrack</strong> bucket.
              Metadata and public URLs are resolved by the mobile/web soundtrack
              client. Admin does not host audio files in Mongo.
            </p>
          </div>
        </div>

        <ul className="mt-6 space-y-2 border-t border-[#252A33] pt-4 text-sm text-[#A7ADB8]">
          <li>· Music remains available only through user Settings.</li>
          <li>· Default state on the product is OFF.</li>
          <li>· Hero banner management is under Content — not here.</li>
          <li>· Do not use the public Plazore orb as an admin music preloader.</li>
        </ul>
      </Panel>
    </div>
  );
}