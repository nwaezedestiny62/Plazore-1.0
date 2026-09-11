import { Request, Response } from "express";
import Incident from "../models/Incident.js";
import PerformanceEvent from "../models/PerformanceEvent.js";
import {
  getPlatformHealth,
  getSeries,
  getSlowRoutes,
  getRecentErrors,
  detectSimpleAnomalies,
} from "../services/performanceHealth.js";
import mongoose from "mongoose";

function parseEnv(q: any): "production" | "development" | "test" {
  const e = String(q || "production").toLowerCase();
  if (e === "development" || e === "dev") return "development";
  if (e === "test") return "test";
  return "production";
}

function parseRangeMs(range: string): number {
  switch (range) {
    case "5m":
      return 5 * 60 * 1000;
    case "1h":
      return 60 * 60 * 1000;
    case "6h":
      return 6 * 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
}

export const getPerformanceOverview = async (req: Request, res: Response) => {
  try {
    const environment = parseEnv(req.query.environment);
    const range = String(req.query.range || "1h");
    const since = new Date(Date.now() - parseRangeMs(range));

    const [health, anomalies, incidents, slow, errors, seriesReq, seriesLat, seriesErr] =
      await Promise.all([
        getPlatformHealth(environment),
        detectSimpleAnomalies(environment),
        Incident.find({ environment }).sort({ lastDetected: -1 }).limit(30).lean(),
        getSlowRoutes(environment, since),
        getRecentErrors(environment, since),
        getSeries(environment, "all", "requests", since),
        getSeries(environment, "all", "avgLatency", since),
        getSeries(environment, "all", "errorRate", since),
      ]);

    const Order = (await import("../models/Order.js")).default;
    const ProductPerformance = (await import("../models/ProductPerformance.js")).default;
    const seven = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [orders7d, viewsAgg] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: seven } }).catch(() => 0),
      ProductPerformance.aggregate([
        {
          $group: {
            _id: null,
            views: { $sum: "$views" },
            carts: { $sum: "$cartAdds" },
            purchases: { $sum: "$purchases" },
          },
        },
      ]).catch(() => []),
    ]);

    res.json({
      success: true,
      data: {
        environment,
        range,
        generatedAt: new Date().toISOString(),
        health,
        anomalies,
        incidents,
        slowOperations: {
          api: slow,
          database: {
            note: "Per-query MongoDB profiling is not enabled.",
            items: [],
          },
          web: {
            note: "Client-side route performance (Web Vitals) is not instrumented yet.",
            items: [],
          },
          app: {
            note: "Native crash / JS exception reporting is not instrumented yet.",
            items: [],
          },
        },
        recentErrors: errors,
        series: {
          requests: seriesReq,
          avgLatency: seriesLat,
          errorRate: seriesErr,
        },
        appVsWeb: {
          note: "Attribution requires clients to send header x-plazore-surface: app|web|admin.",
          app: health.services.app,
          web: health.services.web,
        },
        database: {
          connectionReadyState: mongoose.connection.readyState,
          state: health.services.database.state,
          note: health.services.database.note,
          metricsAvailable: false,
          detail:
            "Reads/writes/query latency require MongoDB profiling or an external APM. Connection state only is available natively.",
        },
        crashes: {
          app: { available: false, note: "No crash reporter integrated." },
          web: { available: false, note: "No frontend error telemetry pipeline yet." },
        },
        commerceActivity: {
          note: "Commerce signals from existing marketplace data — not system performance.",
          ordersLast7d: orders7d,
          productViewsAllTime: viewsAgg[0]?.views ?? null,
          cartAddsAllTime: viewsAgg[0]?.carts ?? null,
          purchasesAllTime: viewsAgg[0]?.purchases ?? null,
        },
        instrumentation: {
          requestMetrics: true,
          requestSampling: process.env.PERF_SAMPLE_RATE || "1",
          surfaceHeader: "x-plazore-surface",
          aggregates: true,
          incidents: true,
          clientCrashes: false,
          dbQueryProfiling: false,
          paymentProviderHealth: false,
          authProviderHealth: false,
          webVitals: false,
        },
      },
    });
  } catch (error: any) {
    console.error("getPerformanceOverview:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPerformanceHealthSummary = async (req: Request, res: Response) => {
  try {
    const environment = parseEnv(req.query.environment);
    const health = await getPlatformHealth(environment);
    res.json({
      success: true,
      data: {
        overall: health.overall,
        activeIncidents: health.activeIncidents,
        services: {
          app: health.services.app.state,
          web: health.services.web.state,
          api: health.services.api.state,
          database: health.services.database.state,
        },
        lastObserved: health.lastObserved,
        environment,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateIncidentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ["detected", "investigating", "monitoring", "resolved", "ignored"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const doc = await Incident.findByIdAndUpdate(id, { status }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: doc });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const ingestClientError = async (req: Request, res: Response) => {
  try {
    const environment = parseEnv(req.body?.environment || process.env.PLAZORE_ENV);
    const surface = ["app", "web", "admin"].includes(req.body?.surface)
      ? req.body.surface
      : "unknown";
    const message = String(req.body?.message || "").slice(0, 500);
    const route = String(req.body?.route || "").slice(0, 200);
    const errorType = String(req.body?.errorType || "client_error").slice(0, 100);

    if (!message) {
      return res.status(400).json({ success: false, message: "message required" });
    }

    await PerformanceEvent.create({
      environment,
      surface,
      service: surface === "app" ? "mobile" : "web",
      eventType: "error",
      route,
      success: false,
      errorType,
      message,
      version: req.body?.version ? String(req.body.version).slice(0, 40) : undefined,
      meta: {
        platform: req.body?.platform ? String(req.body.platform).slice(0, 40) : undefined,
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};