import { useParams, Link } from "react-router";
import { Loader2 } from "lucide-react";
import { usePageTitle } from "../hooks/usePageTitle";
import { useWorkflowRun, useWorkflowRunStream } from "../hooks/useWorkflowRuns";
import StreamTerminal from "../components/StreamTerminal";
import type { RunStatus, StepStatus } from "../types";

const runStatusConfig: Record<
  RunStatus,
  { color: string; bg: string; border: string; label: string; icon: string }
> = {
  pending: { color: "text-fg-3", bg: "bg-surface", border: "border-edge", label: "PENDING", icon: "schedule" },
  running: { color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-500/20", label: "RUNNING", icon: "play_arrow" },
  completed: { color: "text-accent", bg: "bg-accent/10", border: "border-accent/20", label: "COMPLETED", icon: "check_circle" },
  failed: { color: "text-red-400", bg: "bg-red-400/10", border: "border-red-500/20", label: "FAILED", icon: "error" },
};

const stepStatusConfig: Record<
  StepStatus,
  { color: string; bg: string; icon: string; animated?: boolean }
> = {
  pending: { color: "text-fg-3", bg: "bg-surface", icon: "schedule" },
  running: { color: "text-yellow-400", bg: "bg-yellow-400/10", icon: "play_arrow", animated: true },
  completed: { color: "text-accent", bg: "bg-accent/10", icon: "check_circle" },
  failed: { color: "text-red-400", bg: "bg-red-400/10", icon: "error" },
  skipped: { color: "text-fg-4", bg: "bg-surface", icon: "skip_next" },
};

export default function WorkflowRunDetail() {
  usePageTitle("Workflow Run");
  const { runId } = useParams<{ runId: string }>();
  const { data: run, isLoading } = useWorkflowRun(runId);
  const stream = useWorkflowRunStream(runId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent/50" />
      </div>
    );
  }

  if (!run) {
    return (
      <p className="py-20 text-center text-fg-4">Workflow run not found.</p>
    );
  }

  const sc = runStatusConfig[run.status];
  const isActive = run.status === "pending" || run.status === "running";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-fg">
              Run {run.id.slice(0, 8)}
            </h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-bold uppercase tracking-wider ${sc.bg} ${sc.color} ${sc.border}`}>
              {run.status === "running" && (
                <span className="size-1.5 animate-pulse rounded-full bg-current" />
              )}
              {sc.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-fg-3">
            Workflow:{" "}
            <Link
              to={`/workflows/${encodeURIComponent(run.workflow_name)}`}
              className="text-accent transition-colors hover:underline"
            >
              {run.workflow_name}
            </Link>
          </p>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-edge bg-surface-alt p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg-2">
            <span className="material-symbols-outlined text-accent text-base">schedule</span>
            Timing
          </h3>
          <div className="space-y-1 text-sm text-fg-3">
            <p>Created: {new Date(run.created_at).toLocaleString()}</p>
            {run.started_at && (
              <p>Started: {new Date(run.started_at).toLocaleString()}</p>
            )}
            {run.finished_at && (
              <p>Finished: {new Date(run.finished_at).toLocaleString()}</p>
            )}
            {run.started_at && run.finished_at && (
              <p className="font-mono text-fg">
                Duration:{" "}
                {formatDuration(
                  (new Date(run.finished_at).getTime() -
                    new Date(run.started_at).getTime()) /
                    1000,
                )}
              </p>
            )}
          </div>
        </div>
        {run.params && Object.keys(run.params).length > 0 && (
          <div className="rounded-xl border border-edge bg-surface-alt p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg-2">
              <span className="material-symbols-outlined text-accent text-base">tune</span>
              Parameters
            </h3>
            <div className="space-y-1 text-sm">
              {Object.entries(run.params).map(([key, val]) => (
                <p key={key}>
                  <span className="font-mono text-fg-3">{key}</span>
                  <span className="text-fg-4"> = </span>
                  <span className="text-fg">{val}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Steps pipeline */}
      {run.steps && run.steps.length > 0 && (
        <div className="rounded-xl border border-edge bg-surface-alt overflow-hidden">
          <div className="flex items-center justify-between border-b border-edge bg-surface/70 px-6 py-4">
            <h3 className="flex items-center gap-2 font-bold text-fg">
              <span className="material-symbols-outlined text-sm text-accent">schema</span>
              Steps
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {run.steps.map((step, i) => {
              const cfg = stepStatusConfig[step.status];
              return (
                <div key={step.step_name}>
                  <div className="flex items-center gap-3 rounded-lg border border-edge bg-surface p-4 transition-colors hover:border-accent/30">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-alt font-mono text-sm font-bold text-accent/60">
                      {i + 1}
                    </span>
                    <span className={`material-symbols-outlined ${cfg.color} ${cfg.animated ? "animate-spin" : ""}`}>
                      {cfg.icon}
                    </span>
                    <span className="text-sm font-medium text-fg">
                      {step.step_name}
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${cfg.bg} ${cfg.color}`} style={{ borderColor: "currentColor", opacity: 0.7 }}>
                      {step.status}
                    </span>
                    {step.task_id && (
                      <Link
                        to={`/tasks/${step.task_id}`}
                        className="ml-auto flex items-center gap-1 text-xs text-accent transition-colors hover:underline"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        Task {step.task_id.slice(0, 8)}
                      </Link>
                    )}
                    {step.error && (
                      <span className="ml-auto truncate text-xs text-red-400">
                        {step.error}
                      </span>
                    )}
                  </div>
                  {i < run.steps!.length - 1 && (
                    <div className="ml-[19px] flex h-4 items-center">
                      <div className="h-full w-px bg-edge" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stream */}
      {(isActive || stream.events.length > 0) && (
        <StreamTerminal events={stream.events} />
      )}

      {stream.error && (
        <div className="flex items-center justify-between rounded-lg border border-red-900/50 bg-red-900/10 px-4 py-2">
          <p className="text-sm text-red-400">Stream error: {stream.error}</p>
          <button
            onClick={stream.reconnect}
            className="text-xs text-red-300 underline"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Error */}
      {run.error && (
        <div className="rounded-lg border border-red-900/50 bg-red-900/10 p-4">
          <p className="mb-1 flex items-center gap-2 text-sm font-bold text-red-400">
            <span className="material-symbols-outlined text-base">error</span>
            Error
          </p>
          <pre className="whitespace-pre-wrap font-mono text-sm text-red-300">
            {run.error}
          </pre>
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
