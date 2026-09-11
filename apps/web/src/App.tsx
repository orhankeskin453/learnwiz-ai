import { useEffect, useState } from "react";
import type { HealthResponse } from "@learwizai/types";
import { STATUS_PAGE_COPY } from "./copy";

type LoadState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; data: HealthResponse };

const copy = STATUS_PAGE_COPY.en; // Step 2: locale-aware selection replaces this.

export default function App() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/health")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return (await response.json()) as HealthResponse;
      })
      .then((data) => {
        if (!cancelled) setState({ kind: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-slate-900">
      <h1 className="text-2xl font-semibold">{copy.title}</h1>
      <p className="text-sm text-slate-500">{copy.subtitle}</p>
      <section className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
        {state.kind === "loading" && <p className="text-slate-500">{copy.loading}</p>}
        {state.kind === "error" && <p className="text-red-600">{copy.apiDown}</p>}
        {state.kind === "ready" && (
          <dl className="space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">API</dt>
              <dd className="font-medium text-emerald-600">{copy.apiOk}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{copy.env}</dt>
              <dd className="font-medium">{state.data.environment}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{copy.db}</dt>
              <dd className="font-medium">{state.data.checks.db}</dd>
            </div>
          </dl>
        )}
      </section>
    </main>
  );
}
