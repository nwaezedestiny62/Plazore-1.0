import PerformanceAggregate from "../models/PerformanceAggregate.js";
import PerformanceEvent from "../models/PerformanceEvent.js";
import Incident from "../models/Incident.js";
import User from "../models/User.js";
import ProductAI from "../models/ProductAI.js";
import mongoose from "mongoose";

export type HealthState =
  | "operational"
  | "degraded"
  | "warning"
  | "critical"
  | "no_data";

type Env = "production" | "development" | "test";

const LATENCY_WARN_MS = Number(process.env.PERF_LATENCY_WARN_MS || 800);
const LATENCY_CRIT_MS = Number(process.env.PERF_LATENCY_CRIT_MS || 2000);
const ERROR_RATE_WARN = Number(process.env.PERF_ERROR_RATE_WARN || 0.02);
const ERROR_RATE_CRIT = Number(process.env.PERF_ERROR_RATE_CRIT || 0.08);

function stateFromMetrics(
  avgMs: number | null,
  errorRate: number | null,
  hasData: boolean
): HealthState {
  if (!hasData) return "no_data";
  if (errorRate != null && errorRate >= ERROR_RATE_CRIT) return "critical";
  if (avgMs != null && avgMs >= LATENCY_CRIT_MS) return "critical";
  if (errorRate != null && errorRate >= ERROR_RATE_WARN) return "warning";
  if (avgMs != null && avgMs >= LATENCY_WARN_MS) return "degraded";
  return "operational";
}

function overallFrom(states: HealthState[]): HealthState {
  const real = states.filter((s) => s !== "no_data");
  if (real.includes("critical")) return "critical";
  if (real.includes("warning")) return "warning";
  if (real.includes("degraded")) return "degraded";
  if (real.length === 0) return "no_data";
  return "operational";
}

async function windowStats(environment: Env, surface: string | null, since: Date) {
  const match: Record<string, unknown> = {
    environment,
    bucketSize: "1m",
    bucketStart: { $gte: since },
  };
  if (surface) match.surface = surface;

  const rows = await PerformanceAggregate.find(match).lean();
  let requests = 0;
  let errors = 0;
  let totalDuration = 0;
  let slow = 0;
  let maxMs = 0;

  for (const r of rows as any[]) {
    requests += r.requests || 0;
    errors += r.errors || 0;
    totalDuration += r.totalDurationMs || 0;
    slow += r.slowRequests || 0;
    maxMs = Math.max(maxMs, r.maxDurationMs || 0);
  }

  const avgMs = requests ? totalDuration / requests : null;
  const errorRate = requests ? errors / requests : null;

  return {
    requests,
    errors,
    avgMs,
    maxMs: requests ? maxMs : null,
    slow,
    errorRate,
    hasData: requests > 0,
  };
}

/** If requested env has no traffic, fall back to the env that does. */
async function resolveActiveEnv(preferred: Env): Promise<Env> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const preferredStats = await windowStats(preferred, "all", since);
  if (preferredStats.hasData) return preferred;

  for (const e of ["production", "development", "test"] as Env[]) {
    if (e === preferred) continue;
    const s = await windowStats(e, "all", since);
    if (s.hasData) return e;
  }
  return preferred;
}

async function presenceByPlatform(since: Date) {
  const rows = await User.aggregate([
    { $match: { lastSeenAt: { $gte: since } } },
    { $group: { _id: "$lastSeenPlatform", n: { $sum: 1 } } },
  ]);
  const map: Record<string, number> = { app: 0, web: 0, admin: 0 };
  for (const r of rows as any[]) {
    const k = String(r._id || "");
    if (k in map) map[k] = r.n;
  }
  return map;
}

async function checkAuth(): Promise<{
  state: HealthState;
  note: string;
  detail?: Record<string, unknown>;
}> {
  const hasSecret = !!(process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET);
  const hasPublishable = !!(
    process.env.CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  );

  if (!hasSecret && !hasPublishable) {
    return {
      state: "critical",
      note: "Clerk keys missing in server environment",
    };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [withClerk, recentSeen] = await Promise.all([
    User.countDocuments({ clerkId: { $exists: true, $ne: null } }),
    User.countDocuments({ lastSeenAt: { $gte: since } }),
  ]);

  // Optional live ping
  let pingOk: boolean | null = null;
  if (hasSecret) {
    try {
      const key = process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET || "";
      const res = await fetch("https://api.clerk.com/v1/users?limit=1", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(4000),
      });
      pingOk = res.ok;
    } catch {
      pingOk = false;
    }
  }

  if (pingOk === false) {
    return {
      state: "critical",
      note: "Clerk API unreachable with configured secret",
      detail: { withClerk, recentSeen24h: recentSeen },
    };
  }

  if (withClerk === 0) {
    return {
      state: "warning",
      note: "Clerk configured but no users with clerkId yet",
      detail: { withClerk, recentSeen24h: recentSeen, pingOk },
    };
  }

  return {
    state: "operational",
    note:
      pingOk === true
        ? `Clerk reachable · ${withClerk} linked users · ${recentSeen} active 24h`
        : `Clerk keys present · ${withClerk} linked users · ${recentSeen} active 24h`,
    detail: { withClerk, recentSeen24h: recentSeen, pingOk },
  };
}

async function checkStorage(): Promise<{
  state: HealthState;
  note: string;
  detail?: Record<string, unknown>;
}> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const cloudKey = process.env.CLOUDINARY_API_KEY;
  const cloudSecret = process.env.CLOUDINARY_API_SECRET;
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const hasCloudinary = !!(cloudName && cloudKey && cloudSecret);
  const hasSupabase = !!(supabaseUrl && supabaseKey);

  if (!hasCloudinary && !hasSupabase) {
    return {
      state: "critical",
      note: "No Cloudinary or Supabase credentials configured",
    };
  }

  const detail: Record<string, unknown> = {
    cloudinaryConfigured: hasCloudinary,
    supabaseConfigured: hasSupabase,
  };

  // Light Cloudinary ping (usage API)
  if (hasCloudinary) {
    try {
      const auth = Buffer.from(`${cloudKey}:${cloudSecret}`).toString("base64");
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/usage`,
        {
          headers: { Authorization: `Basic ${auth}` },
          signal: AbortSignal.timeout(4000),
        }
      );
      detail.cloudinaryReachable = res.ok;
      if (!res.ok) {
        return {
          state: "degraded",
          note: `Cloudinary responded ${res.status}`,
          detail,
        };
      }
    } catch {
      detail.cloudinaryReachable = false;
      return {
        state: "degraded",
        note: "Cloudinary configured but unreachable",
        detail,
      };
    }
  }

  // Light Supabase ping
  if (hasSupabase) {
    try {
      const base = String(supabaseUrl).replace(/\/$/, "");
      const res = await fetch(`${base}/rest/v1/`, {
        headers: {
          apikey: String(supabaseKey),
          Authorization: `Bearer ${supabaseKey}`,
        },
        signal: AbortSignal.timeout(4000),
      });
      // 200 or 404 from REST root still means reachable
      detail.supabaseReachable = res.status < 500;
      if (res.status >= 500) {
        return {
          state: "degraded",
          note: `Supabase responded ${res.status}`,
          detail,
        };
      }
    } catch {
      detail.supabaseReachable = false;
      return {
        state: "degraded",
        note: "Supabase configured but unreachable",
        detail,
      };
    }
  }

  const parts: string[] = [];
  if (hasCloudinary) parts.push("Cloudinary OK");
  if (hasSupabase) parts.push("Supabase OK");

  return {
    state: "operational",
    note: parts.join(" · "),
    detail,
  };
}

async function checkJobs(): Promise<{
  state: HealthState;
  note: string;
  detail?: Record<string, unknown>;
}> {
  try {
    const [pending, failed, ready] = await Promise.all([
      ProductAI.countDocuments({ status: "pending" }),
      ProductAI.countDocuments({ status: "failed" }),
      ProductAI.countDocuments({ status: "ready" }),
    ]);

    const total = pending + failed + ready;
    if (total === 0) {
      return {
        state: "operational",
        note: "AI job queue empty (no ProductAI docs yet)",
        detail: { pending, failed, ready },
      };
    }

    const failRate = failed / Math.max(1, total);
    if (failRate >= 0.25 && failed >= 5) {
      return {
        state: "critical",
        note: `AI jobs failing heavily · pending ${pending} · failed ${failed} · ready ${ready}`,
        detail: { pending, failed, ready, failRate },
      };
    }
    if (pending >= 50) {
      return {
        state: "warning",
        note: `AI job backlog growing · pending ${pending} · failed ${failed}`,
        detail: { pending, failed, ready },
      };
    }
    if (failed > 0) {
      return {
        state: "degraded",
        note: `Some AI jobs failed · pending ${pending} · failed ${failed} · ready ${ready}`,
        detail: { pending, failed, ready },
      };
    }

    return {
      state: "operational",
      note: `AI jobs healthy · pending ${pending} · ready ${ready}`,
      detail: { pending, failed, ready },
    };
  } catch (e: any) {
    return {
      state: "warning",
      note: `Could not read job queue: ${e?.message || "error"}`,
    };
  }
}

async function checkDatabase(): Promise<{
  state: HealthState;
  note: string;
  detail?: Record<string, unknown>;
}> {
  const readyState = mongoose.connection.readyState;
  // 0=disconnected 1=connected 2=connecting 3=disconnecting
  if (readyState !== 1) {
    return {
      state: "critical",
      note: "MongoDB not connected",
      detail: { connectionReadyState: readyState },
    };
  }

  try {
    const start = Date.now();
    if (!mongoose.connection.db) {
      return {
        state: "degraded",
        note: "MongoDB connected but db handle missing",
        detail: { connectionReadyState: readyState },
      };
    }
    await mongoose.connection.db.admin().ping();
    const pingMs = Date.now() - start;

    let collections = 0;
    try {
      const cols = await mongoose.connection.db.listCollections().toArray();
      collections = cols.length;
    } catch {
      // ignore
    }

    let state: HealthState = "operational";
    if (pingMs >= 500) state = "degraded";
    if (pingMs >= 2000) state = "warning";

    return {
      state,
      note: `MongoDB ping ${pingMs}ms · ${collections} collections`,
      detail: { connectionReadyState: readyState, pingMs, collections },
    };
  } catch (e: any) {
    return {
      state: "critical",
      note: `MongoDB ping failed: ${e?.message || "error"}`,
      detail: { connectionReadyState: readyState },
    };
  }
}

export async function getPlatformHealth(environment: Env) {
  const activeEnv = await resolveActiveEnv(environment);
  const since15 = new Date(Date.now() - 15 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [all, appTraffic, webTraffic, presence, auth, storage, jobs, database] =
    await Promise.all([
      windowStats(activeEnv, "all", since15),
      windowStats(activeEnv, "app", since15),
      windowStats(activeEnv, "web", since15),
      presenceByPlatform(since24h),
      checkAuth(),
      checkStorage(),
      checkJobs(),
      checkDatabase(),
    ]);

  // API: if no aggregate yet but this handler ran + DB up → operational
  let apiState = stateFromMetrics(all.avgMs, all.errorRate, all.hasData);
  let apiNote = all.hasData
    ? `avg ${Math.round(all.avgMs || 0)}ms · err ${((all.errorRate || 0) * 100).toFixed(2)}% · ${all.requests} req / 15m`
    : "API responding (no request aggregates in window yet — traffic will fill this)";
  if (!all.hasData && database.state !== "critical") {
    apiState = "operational";
  }

  // App / Web: prefer surface telemetry; else presence from lastSeenPlatform
  function surfaceState(
    traffic: Awaited<ReturnType<typeof windowStats>>,
    activeUsers: number,
    label: string
  ): { state: HealthState; note: string; requests: number; avgMs: number | null; errorRate: number | null } {
    if (traffic.hasData) {
      return {
        state: stateFromMetrics(traffic.avgMs, traffic.errorRate, true),
        note: `${label} traffic · ${traffic.requests} req / 15m · ${activeUsers} users seen 24h`,
        requests: traffic.requests,
        avgMs: traffic.avgMs,
        errorRate: traffic.errorRate,
      };
    }
    if (activeUsers > 0) {
      return {
        state: "operational",
        note: `No surface-tagged API traffic yet · ${activeUsers} ${label} users active 24h (lastSeenPlatform)`,
        requests: 0,
        avgMs: null,
        errorRate: null,
      };
    }
    return {
      state: "operational",
      note: `No ${label} traffic in window · waiting for clients / presence`,
      requests: 0,
      avgMs: null,
      errorRate: null,
    };
  }

  const appS = surfaceState(appTraffic, presence.app, "app");
  const webS = surfaceState(webTraffic, presence.web, "web");

  const openIncidents = await Incident.countDocuments({
    environment: activeEnv,
    status: { $in: ["detected", "investigating", "monitoring"] },
  });

  const overall = overallFrom([
    apiState,
    appS.state,
    webS.state,
    database.state,
    auth.state,
    storage.state,
    jobs.state,
  ]);

  return {
    environment: activeEnv,
    requestedEnvironment: environment,
    environmentNote:
      activeEnv !== environment
        ? `Showing ${activeEnv} (had data). UI asked for ${environment}.`
        : undefined,
    overall,
    lastObserved: new Date().toISOString(),
    window: "15m",
    services: {
      overall: {
        state: overall,
        note: "From API, App/Web presence, DB, Auth, Storage, Jobs (payments excluded)",
      },
      app: {
        state: appS.state,
        requests: appS.requests,
        avgMs: appS.avgMs,
        errorRate: appS.errorRate,
        activeUsers24h: presence.app,
        note: appS.note,
      },
      web: {
        state: webS.state,
        requests: webS.requests,
        avgMs: webS.avgMs,
        errorRate: webS.errorRate,
        activeUsers24h: presence.web,
        note: webS.note,
      },
      api: {
        state: apiState,
        requests: all.requests,
        avgMs: all.avgMs,
        errorRate: all.errorRate,
        maxMs: all.maxMs,
        slow: all.slow,
        note: apiNote,
      },
      database: {
        state: database.state,
        note: database.note,
        connectionReadyState: mongoose.connection.readyState,
        detail: database.detail,
      },
      authentication: {
        state: auth.state,
        note: auth.note,
        detail: auth.detail,
      },
      payments: {
        state: "no_data" as HealthState,
        note: "Not instrumented — payment provider health not collected",
      },
      storage: {
        state: storage.state,
        note: storage.note,
        detail: storage.detail,
      },
      backgroundJobs: {
        state: jobs.state,
        note: jobs.note,
        detail: jobs.detail,
      },
    },
    activeIncidents: openIncidents,
    thresholds: {
      latencyWarnMs: LATENCY_WARN_MS,
      latencyCritMs: LATENCY_CRIT_MS,
      errorRateWarn: ERROR_RATE_WARN,
      errorRateCrit: ERROR_RATE_CRIT,
    },
  };
}

export async function getSeries(
  environment: Env,
  surface: string,
  metric: string,
  since: Date
) {
  const activeEnv = await resolveActiveEnv(environment);
  const match: Record<string, unknown> = {
    environment: activeEnv,
    bucketSize: "1m",
    bucketStart: { $gte: since },
  };
  if (surface && surface !== "all") match.surface = surface;
  else match.surface = "all";

  const rows = await PerformanceAggregate.find(match)
    .sort({ bucketStart: 1 })
    .lean();

  return (rows as any[]).map((r) => {
    const requests = r.requests || 0;
    let value = 0;
    switch (metric) {
      case "requests":
        value = requests;
        break;
      case "errors":
        value = r.errors || 0;
        break;
      case "errorRate":
        value = requests ? (r.errors || 0) / requests : 0;
        break;
      case "avgLatency":
        value = requests ? (r.totalDurationMs || 0) / requests : 0;
        break;
      case "maxLatency":
        value = r.maxDurationMs || 0;
        break;
      case "slowRequests":
        value = r.slowRequests || 0;
        break;
      default:
        value = requests;
    }
    return {
      t: r.bucketStart,
      v: Math.round(value * 1000) / 1000,
      requests,
    };
  });
}

export async function getSlowRoutes(environment: Env, since: Date, limit = 15) {
  const activeEnv = await resolveActiveEnv(environment);
  const rows = await PerformanceEvent.aggregate([
    {
      $match: {
        environment: activeEnv,
        eventType: { $in: ["request", "error"] },
        createdAt: { $gte: since },
        durationMs: { $gte: Number(process.env.PERF_SLOW_REQUEST_MS || 1500) },
      },
    },
    {
      $group: {
        _id: { route: "$route", surface: "$surface" },
        count: { $sum: 1 },
        avgMs: { $avg: "$durationMs" },
        maxMs: { $max: "$durationMs" },
        errors: {
          $sum: { $cond: [{ $gte: ["$statusCode", 500] }, 1, 0] },
        },
      },
    },
    { $sort: { avgMs: -1 } },
    { $limit: limit },
  ]);

  return rows.map((r: any) => ({
    route: r._id.route,
    surface: r._id.surface,
    count: r.count,
    avgMs: Math.round(r.avgMs),
    maxMs: Math.round(r.maxMs),
    errors: r.errors,
  }));
}

export async function getRecentErrors(environment: Env, since: Date, limit = 25) {
  const activeEnv = await resolveActiveEnv(environment);
  return PerformanceEvent.find({
    environment: activeEnv,
    $or: [
      { eventType: "error" },
      { statusCode: { $gte: 500 } },
      { success: false },
    ],
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("surface route statusCode durationMs message errorType createdAt")
    .lean();
}

export async function detectSimpleAnomalies(environment: Env) {
  const activeEnv = await resolveActiveEnv(environment);
  const now = Date.now();
  const curSince = new Date(now - 15 * 60 * 1000);
  const prevSince = new Date(now - 30 * 60 * 1000);
  const prevUntil = curSince;

  const cur = await windowStats(activeEnv, "all", curSince);
  const prevMatch: Record<string, unknown> = {
    environment: activeEnv,
    surface: "all",
    bucketSize: "1m",
    bucketStart: { $gte: prevSince, $lt: prevUntil },
  };
  const prevRows = await PerformanceAggregate.find(prevMatch).lean();
  let prevRequests = 0;
  let prevErrors = 0;
  let prevDuration = 0;
  for (const r of prevRows as any[]) {
    prevRequests += r.requests || 0;
    prevErrors += r.errors || 0;
    prevDuration += r.totalDurationMs || 0;
  }
  const prev = {
    requests: prevRequests,
    errorRate: prevRequests ? prevErrors / prevRequests : null,
    avgMs: prevRequests ? prevDuration / prevRequests : null,
    hasData: prevRequests > 0,
  };

  const found: Array<{
    severity: "critical" | "high" | "medium" | "low" | "observation";
    title: string;
    description: string;
    source: string;
  }> = [];

  if (cur.hasData && cur.errorRate != null && cur.errorRate >= ERROR_RATE_CRIT) {
    found.push({
      severity: "critical",
      title: "API error rate exceeded critical threshold",
      description: `Error rate ${(cur.errorRate * 100).toFixed(2)}% over last 15m.`,
      source: "api",
    });
  } else if (cur.hasData && cur.errorRate != null && cur.errorRate >= ERROR_RATE_WARN) {
    found.push({
      severity: "high",
      title: "API error rate elevated",
      description: `Error rate ${(cur.errorRate * 100).toFixed(2)}% over last 15m.`,
      source: "api",
    });
  }

  if (cur.hasData && cur.avgMs != null && cur.avgMs >= LATENCY_CRIT_MS) {
    found.push({
      severity: "critical",
      title: "API latency critical",
      description: `Average latency ${Math.round(cur.avgMs)}ms over last 15m.`,
      source: "api",
    });
  } else if (cur.hasData && cur.avgMs != null && cur.avgMs >= LATENCY_WARN_MS) {
    found.push({
      severity: "medium",
      title: "API latency degraded",
      description: `Average latency ${Math.round(cur.avgMs)}ms over last 15m.`,
      source: "api",
    });
  }

  if (cur.hasData && prev.hasData && prev.requests > 20 && cur.requests > prev.requests * 2.5) {
    found.push({
      severity: "observation",
      title: "Request volume spike",
      description: `Requests last 15m: ${cur.requests} vs previous 15m: ${prev.requests}.`,
      source: "api",
    });
  }

  for (const f of found.filter((x) => x.severity === "critical" || x.severity === "high")) {
    const existing = await Incident.findOne({
      environment: activeEnv,
      title: f.title,
      status: { $in: ["detected", "investigating", "monitoring"] },
    });
    if (existing) {
      existing.lastDetected = new Date();
      existing.occurrences += 1;
      await existing.save();
    } else {
      await Incident.create({
        environment: activeEnv,
        severity: f.severity,
        status: "detected",
        source: f.source,
        title: f.title,
        description: f.description,
        firstDetected: new Date(),
        lastDetected: new Date(),
        occurrences: 1,
      });
    }
  }

  return found;
}