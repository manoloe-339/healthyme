"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface LogEntry {
  id: number;
  timestamp: string;
  method: string | null;
  path: string | null;
  headers: string | null;
  bodyPreview: string | null;
  bodySize: number | null;
  responseStatus: number | null;
  responseBody: string | null;
  metricsFound: string | null;
}

export default function DebugPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/debug/logs")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs))
      .finally(() => setLoading(false));
  }, []);

  function copyAll() {
    const text = logs
      .map((l) => {
        const ts = new Date(l.timestamp).toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
        return [
          `--- ${ts} PT ---`,
          `${l.method} ${l.path} → ${l.responseStatus}`,
          `Size: ${l.bodySize} bytes`,
          `Headers: ${l.headers}`,
          `Metrics: ${l.metricsFound ?? "none"}`,
          `Body/Dates: ${l.bodyPreview}`,
          `Response: ${l.responseBody}`,
          "",
        ].join("\n");
      })
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function refresh() {
    setLoading(true);
    fetch("/api/debug/logs")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs))
      .finally(() => setLoading(false));
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Debug Logs</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="text-xs" onClick={refresh}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button variant="secondary" size="sm" className="text-xs" onClick={copyAll}>
            {copied ? "Copied!" : "Copy All"}
          </Button>
          <Link href="/">
            <Button variant="outline" size="sm" className="text-xs">Dashboard</Button>
          </Link>
        </div>
      </div>

      {logs.length === 0 && !loading && (
        <p className="text-sm text-zinc-500">No webhook requests logged yet.</p>
      )}

      {logs.map((l) => {
        const ts = new Date(l.timestamp).toLocaleString("en-US", {
          timeZone: "America/Los_Angeles",
          month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit",
        });
        const isError = (l.responseStatus ?? 0) >= 400;

        return (
          <div
            key={l.id}
            className={`rounded-lg border p-3 text-xs font-mono space-y-1 ${isError ? "border-red-800 bg-red-950/30" : "border-zinc-800 bg-zinc-900/50"}`}
          >
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">{ts} PT</span>
              <span className={`font-bold ${isError ? "text-red-400" : "text-green-400"}`}>
                {l.responseStatus}
              </span>
            </div>
            <p className="text-zinc-300">{l.method} {l.path}</p>
            <p className="text-zinc-500">Size: {l.bodySize?.toLocaleString()} bytes</p>
            {l.metricsFound && (
              <div>
                <span className="text-zinc-500">Metrics: </span>
                <span className="text-zinc-300">{l.metricsFound}</span>
              </div>
            )}
            {l.bodyPreview && (
              <div>
                <span className="text-zinc-500">Data: </span>
                <span className="text-zinc-400">{l.bodyPreview}</span>
              </div>
            )}
            {l.headers && (
              <details className="text-zinc-600">
                <summary className="cursor-pointer hover:text-zinc-400">Headers</summary>
                <pre className="mt-1 text-zinc-500 whitespace-pre-wrap">{l.headers}</pre>
              </details>
            )}
            {l.responseBody && (
              <details className="text-zinc-600">
                <summary className="cursor-pointer hover:text-zinc-400">Response</summary>
                <pre className="mt-1 text-zinc-500 whitespace-pre-wrap">{l.responseBody}</pre>
              </details>
            )}
          </div>
        );
      })}
    </main>
  );
}
