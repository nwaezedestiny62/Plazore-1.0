"use client";

import Image from "next/image";
import { Lock } from "lucide-react";

export type AnnouncementDesign = {
  layout?: "stack" | "split" | "banner";
  theme?: "dark" | "light" | "brand";
  accent?: "green" | "amber" | "blue" | "neutral";
  titleSize?: "sm" | "md" | "lg";
  mediaAspect?: "16:9" | "1:1" | "4:5" | "auto";
  showMediaTop?: boolean;
};

export type AnnouncementData = {
  _id?: string;
  headline?: string;
  body?: string;
  mediaType?: "none" | "image" | "video";
  mediaUrl?: string;
  mediaPosterUrl?: string;
  actionLabel?: string;
  actionRoute?: string;
  design?: AnnouncementDesign;
  publishedAt?: string;
};

const ACCENT: Record<string, string> = {
  green: "#00E575",
  amber: "#F59E0B",
  blue: "#3B82F6",
  neutral: "#A7ADB8",
};

function aspectClass(a?: string) {
  if (a === "1:1") return "aspect-square";
  if (a === "4:5") return "aspect-[4/5]";
  if (a === "auto") return "min-h-[140px]";
  return "aspect-video";
}

type Props = {
  data: AnnouncementData;
  onAction?: (route: string) => void;
};

export function AnnouncementCard({ data, onAction }: Props) {
  const design = data.design || {};
  const accent = ACCENT[design.accent || "green"] || ACCENT.green;
  const isLight = design.theme === "light";
  const titleSize =
    design.titleSize === "sm"
      ? "text-base"
      : design.titleSize === "lg"
        ? "text-2xl"
        : "text-xl";

  const showMedia =
    !!data.mediaType &&
    data.mediaType !== "none" &&
    !!data.mediaUrl &&
    design.showMediaTop !== false;

  const cardBg = isLight ? "bg-[#F5F7FA]" : "bg-[#11141A]";
  const titleColor = isLight ? "text-[#0C0F14]" : "text-[#F5F7FA]";
  const bodyColor = isLight ? "text-[#4B5563]" : "text-[#A7ADB8]";
  const border = isLight ? "border-black/10" : "border-[#252A33]";

  const media = showMedia ? (
    <div
      className={`relative w-full overflow-hidden bg-[#0C0F14] ${aspectClass(
        design.mediaAspect
      )}`}
    >
      {data.mediaType === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.mediaUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <a
          href={data.mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="relative block h-full w-full"
        >
          {data.mediaPosterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.mediaPosterUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-[#0C0F14]" />
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white">
              ▶
            </span>
          </span>
        </a>
      )}
    </div>
  ) : null;

  return (
    <article className={`overflow-hidden border ${border} ${cardBg}`}>
      <div className="h-[3px] w-full" style={{ backgroundColor: accent }} />

      {showMedia && design.layout !== "split" ? media : null}

      <div className="p-4 sm:p-5">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <span
            className="border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
            style={{ borderColor: `${accent}55`, color: accent }}
          >
            Announcement
          </span>
        </div>

        <h2
          className={`font-extrabold tracking-tight ${titleSize} ${titleColor}`}
        >
          {data.headline || "Announcement"}
        </h2>

        {data.body ? (
          <p className={`mt-2.5 text-sm leading-relaxed whitespace-pre-wrap ${bodyColor}`}>
            {data.body}
          </p>
        ) : null}

        {data.publishedAt ? (
          <p className="mt-3 text-[11px] text-[#737A86]">
            {new Date(data.publishedAt).toLocaleString()}
          </p>
        ) : null}

        {data.actionLabel && data.actionRoute ? (
          <button
            type="button"
            onClick={() => onAction?.(data.actionRoute!)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-[#041412]"
            style={{ backgroundColor: accent }}
          >
            {data.actionLabel}
            <span aria-hidden>→</span>
          </button>
        ) : null}
      </div>

      {showMedia && design.layout === "split" ? (
        <div className="border-t border-[#252A33]">{media}</div>
      ) : null}
    </article>
  );
}

export default AnnouncementCard;