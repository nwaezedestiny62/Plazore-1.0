import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function PageHeader({
  title,
  description,
  meta,
}: {
  title: string;
  description?: string;
  meta?: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
          Plazore Admin
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#F5F7FA]">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#A7ADB8]">{description}</p>
        ) : null}
      </div>
      {meta ? <p className="text-xs tabular-nums text-[#737A86]">{meta}</p> : null}
    </div>
  );
}

export function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="border border-[#252A33] bg-[#11141A] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737A86]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#F5F7FA]">{value}</p>
      {hint ? <p className="mt-1 text-[12px] text-[#737A86]">{hint}</p> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "warn" | "error" | "blue";
}) {
  const map = {
    neutral: "border-[#252A33] bg-[#171B22] text-[#A7ADB8]",
    green: "border-[#00E575]/30 bg-[#00E575]/10 text-[#00E575]",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    error: "border-red-500/30 bg-red-500/10 text-red-300",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  } as const;
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 text-[11px] font-medium ${map[tone]}`}>
      {children}
    </span>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 w-full border border-[#252A33] bg-[#171B22] px-3 text-sm text-[#F5F7FA] outline-none placeholder:text-[#737A86] focus:border-[#00E575]/50 ${props.className || ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 border border-[#252A33] bg-[#171B22] px-3 text-sm text-[#F5F7FA] outline-none focus:border-[#00E575]/50 ${props.className || ""}`}
    />
  );
}

export function Button({
  tone = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-[#00E575] text-[#041412] hover:brightness-105",
    ghost: "border border-[#252A33] bg-[#171B22] text-[#A7ADB8] hover:text-[#F5F7FA]",
    danger: "border border-red-500/40 bg-red-500/10 text-red-300",
  } as const;
  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-50 ${styles[tone]} ${props.className || ""}`}
    />
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`border border-[#252A33] bg-[#11141A] ${className}`}>{children}</div>;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <Panel className="p-10 text-center">
      <p className="text-sm font-medium text-[#F5F7FA]">{title}</p>
      {body ? <p className="mt-1 text-sm text-[#737A86]">{body}</p> : null}
    </Panel>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return <Panel className="p-8 text-sm text-[#737A86]">{label}</Panel>;
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{message}</div>
  );
}