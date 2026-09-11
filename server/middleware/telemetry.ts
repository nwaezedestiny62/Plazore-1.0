import { Request, Response, NextFunction } from "express";
import PerformanceEvent from "../models/PerformanceEvent.js";
import PerformanceAggregate from "../models/PerformanceAggregate.js";

const SLOW_MS = Number(process.env.PERF_SLOW_REQUEST_MS || 1500);
const SAMPLE_RATE = Math.min(
  1,
  Math.max(0.01, Number(process.env.PERF_SAMPLE_RATE || 1))
);

function resolveEnvironment(): "production" | "development" | "test" {
  const e = (
    process.env.PLAZORE_ENV ||
    process.env.NODE_ENV ||
    "development"
  ).toLowerCase();
  if (e === "production" || e === "prod") return "production";
  if (e === "test") return "test";
  return "development";
}

function resolveSurface(
  req: Request
): "app" | "web" | "admin" | "api" | "unknown" {
  const h =
    (req.headers["x-plazore-surface"] as string) ||
    (req.headers["x-client-surface"] as string) ||
    "";
  const v = h.toLowerCase();
  if (v === "app" || v === "mobile") return "app";
  if (v === "web") return "web";
  if (v === "admin") return "admin";
  if (req.path.startsWith("/api/admin")) return "admin";
  return "api";
}

function normalizeRoute(req: Request): string {
  const r = (req as any).route?.path;
  if (r && typeof r === "string") {
    const base = req.baseUrl || "";
    return `${base}${r}`.replace(/\/+/g, "/") || req.path;
  }
  return (req.path || "/")
    .replace(/[0-9a-fA-F]{24}/g, ":id")
    .replace(/\/\d+/g, "/:id");
}

function floorBucket(d: Date, sizeMs: number): Date {
  return new Date(Math.floor(d.getTime() / sizeMs) * sizeMs);
}

async function bumpAggregate(opts: {
  environment: "production" | "development" | "test";
  surface: "app" | "web" | "admin" | "api" | "unknown";
  at: Date;
  durationMs: number;
  statusCode: number;
  success: boolean;
  slow: boolean;
}) {
  const bucketStart = floorBucket(opts.at, 60_000); // 1m
  const statusKey =
    opts.statusCode >= 500
      ? "status5xx"
      : opts.statusCode >= 400
        ? "status4xx"
        : "status2xx";

  const inc: Record<string, number> = {
    requests: 1,
    totalDurationMs: opts.durationMs,
    [statusKey]: 1,
  };
  if (!opts.success || opts.statusCode >= 500) inc.errors = 1;
  if (opts.slow) inc.slowRequests = 1;

  // Per-surface bucket
  await PerformanceAggregate.findOneAndUpdate(
    {
      environment: opts.environment,
      surface: opts.surface,
      bucketSize: "1m",
      bucketStart,
    },
    {
      $inc: inc,
      $max: { maxDurationMs: opts.durationMs },
      $setOnInsert: {
        environment: opts.environment,
        surface: opts.surface,
        bucketSize: "1m",
        bucketStart,
      },
    },
    { upsert: true }
  ).catch(() => {});

  // Combined "all" bucket
  await PerformanceAggregate.findOneAndUpdate(
    {
      environment: opts.environment,
      surface: "all",
      bucketSize: "1m",
      bucketStart,
    },
    {
      $inc: inc,
      $max: { maxDurationMs: opts.durationMs },
      $setOnInsert: {
        environment: opts.environment,
        surface: "all",
        bucketSize: "1m",
        bucketStart,
      },
    },
    { upsert: true }
  ).catch(() => {});
}

export function telemetryMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (
    req.path === "/" ||
    req.path === "/api/test" ||
    req.path.startsWith("/favicon")
  ) {
    return next();
  }

  const start = process.hrtime.bigint();
  const environment = resolveEnvironment();
  const surface = resolveSurface(req);

  res.on("finish", () => {
    try {
      if (Math.random() > SAMPLE_RATE) return;

      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      const statusCode = res.statusCode || 0;
      const success = statusCode < 500;
      const slow = durationMs >= SLOW_MS;
      const route = normalizeRoute(req);
      const now = new Date();

      PerformanceEvent.create({
        environment,
        surface,
        service: "api",
        eventType: statusCode >= 500 ? "error" : "request",
        method: req.method,
        route,
        statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        success,
        message: statusCode >= 500 ? `HTTP ${statusCode}` : undefined,
      }).catch(() => {});

      bumpAggregate({
        environment,
        surface,
        at: now,
        durationMs,
        statusCode,
        success,
        slow,
      }).catch(() => {});
    } catch {
      // never throw from telemetry
    }
  });

  next();
}

export { resolveEnvironment, resolveSurface, SLOW_MS };