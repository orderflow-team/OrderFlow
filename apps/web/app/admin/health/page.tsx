'use client';

import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Database,
  Cpu,
  RefreshCw,
  Server,
  Activity,
  CheckCircle,
  Clock,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface HealthData {
  status: string;
  timestamp: string;
  database: {
    status: string;
    latencyMs: number;
    engine: string;
  };
  system: {
    uptimeSeconds: number;
    uptimeFormatted: string;
    nodeVersion: string;
    platform: string;
    memoryUsage: {
      heapUsedMb: string;
      heapTotalMb: string;
      rssMb: string;
    };
  };
}

export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/platform-admin/health');
      setHealth(res.data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to fetch system health', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Auto ping health telemetry every 10 seconds
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <HeartPulse className="w-7 h-7 text-rose-600 dark:text-rose-400 animate-pulse" />
            Real-time System Telemetry & DB Health Ping
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Live server performance counters, PostgreSQL ping latency, memory allocation, and runtime telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Last ping: <span className="font-mono text-foreground font-bold">{lastRefreshed || '-'}</span>
          </span>
          <button
            onClick={fetchHealth}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-foreground text-sm font-medium rounded-xl border border-border transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Ping Now
          </button>
        </div>
      </div>

      {health ? (
        <>
          {/* Status KPI Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* System Status */}
            <div className="bg-card border border-border p-6 rounded-2xl backdrop-blur-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Overall Platform Status</span>
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle className="w-6 h-6" /> {health.status}
              </div>
              <p className="text-xs text-muted-foreground">All microservices and database engines operational</p>
            </div>

            {/* DB Ping Latency */}
            <div className="bg-card border border-border p-6 rounded-2xl backdrop-blur-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">PostgreSQL Ping Latency</span>
                <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="text-2xl font-extrabold text-foreground flex items-center gap-2">
                <Zap className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                {health.database.latencyMs} <span className="text-sm font-normal text-muted-foreground">ms</span>
              </div>
              <p className="text-xs text-muted-foreground">Engine: {health.database.engine} ({health.database.status})</p>
            </div>

            {/* Server Uptime */}
            <div className="bg-card border border-border p-6 rounded-2xl backdrop-blur-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Process Uptime</span>
                <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-2xl font-extrabold text-foreground font-mono">
                {health.system.uptimeFormatted}
              </div>
              <p className="text-xs text-muted-foreground">Continuous runtime execution</p>
            </div>
          </div>

          {/* Memory & Telemetry Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Memory Usage Card */}
            <div className="bg-card border border-border p-6 rounded-2xl space-y-5">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                <Cpu className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Node.js Memory Allocation
              </h3>

              <div className="space-y-4 text-sm">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-foreground font-semibold">Heap Used</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{health.system.memoryUsage.heapUsedMb} MB</span>
                  </div>
                  <div className="w-full h-3 bg-background rounded-full overflow-hidden border border-border">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (parseFloat(health.system.memoryUsage.heapUsedMb) / parseFloat(health.system.memoryUsage.heapTotalMb)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-background p-4 rounded-xl border border-border text-xs">
                  <div>
                    <span className="text-muted-foreground block">Total Heap Allocated</span>
                    <span className="font-mono font-bold text-foreground">{health.system.memoryUsage.heapTotalMb} MB</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Resident Set Size (RSS)</span>
                    <span className="font-mono font-bold text-foreground">{health.system.memoryUsage.rssMb} MB</span>
                  </div>
                </div>
              </div>
            </div>

            {/* System Runtime Metadata */}
            <div className="bg-card border border-border p-6 rounded-2xl space-y-5">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                <Server className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Runtime & Environment Metadata
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                  <span className="text-muted-foreground font-semibold">Node.js Runtime</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{health.system.nodeVersion}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                  <span className="text-muted-foreground font-semibold">OS Platform</span>
                  <span className="font-mono text-foreground font-bold uppercase">{health.system.platform}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                  <span className="text-muted-foreground font-semibold">Database Engine</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">PostgreSQL (TypeORM v0.3)</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="p-12 text-center text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-rose-600 dark:text-rose-400" />
          Connecting to system telemetry agent...
        </div>
      )}
    </div>
  );
}
