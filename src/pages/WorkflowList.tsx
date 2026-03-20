import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router";
import { usePageTitle } from "../hooks/usePageTitle";
import { useWorkflows } from "../hooks/useWorkflows";
import { useWorkflowRuns } from "../hooks/useWorkflowRuns";
import { useCancelWorkflowRun, useCancelAllWorkflowRuns } from "../hooks/useWorkflowMutations";
import { useToast } from "../context/ToastContext";
import type { WorkflowRun, RunStatus } from "../types";

type Tab = "workflows" | "runs";

const runStatusColors: Record<RunStatus, { color: string; bg: string; border: string }> = {
  pending: { color: "text-fg-3", bg: "bg-surface", border: "border-edge" },
  running: { color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-500/20" },
  completed: { color: "text-accent", bg: "bg-accent/10", border: "border-accent/20" },
  failed: { color: "text-red-400", bg: "bg-red-400/10", border: "border-red-500/20" },
  cancelled: { color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-500/20" },
};

const stepTypeIcons: Record<string, string> = {
  fetch: "cloud_download",
  session: "smart_toy",
  action: "rocket_launch",
};

const workflowIcons: Record<string, string> = {
  "sentry-fixer": "bug_report",
  "github-issue-fixer": "code",
  "gitlab-issue-fixer": "code",
  "knowledge-update": "menu_book",
};

export default function WorkflowList() {
  usePageTitle("Workflows");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: workflows = [], isLoading: wfLoading, refetch: refetchWf } = useWorkflows();
  const { data: runs = [], isLoading: runsLoading, refetch: refetchRuns } = useWorkflowRuns();
  const cancelRun = useCancelWorkflowRun();
  const cancelAll = useCancelAllWorkflowRuns();
  const [tab, setTab] = useState<Tab>("workflows");
  const [search, setSearch] = useState("");

  const isLoading = tab === "workflows" ? wfLoading : runsLoading;
  const refetch = tab === "workflows" ? refetchWf : refetchRuns;

  const filteredWorkflows = useMemo(() => {
    const sorted = [...workflows].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    if (!search) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q),
    );
  }, [workflows, search]);

  const filteredRuns = useMemo(() => {
    const sorted = [...runs].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    if (!search) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.workflow_name.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q),
    );
  }, [runs, search]);

  const activeRuns = runs.filter((r) => r.status === "pending" || r.status === "running");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-fg">
            Workflows
          </h1>
          <p className="mt-1 text-sm text-fg-3">
            Automated multi-step pipelines
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "runs" && activeRuns.length > 0 && (
            <button
              onClick={() => {
                cancelAll.mutate(undefined, {
                  onSuccess: (data) => toast("success", data.message),
                  onError: (err) => toast("error", `Cancel failed: ${err.message}`),
                });
              }}
              disabled={cancelAll.isPending}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-red-900/50 bg-red-900/20 px-4 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/40 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">stop_circle</span>
              {cancelAll.isPending ? "Cancelling..." : "Cancel All"}
            </button>
          )}
          <button
            onClick={() => void refetch()}
            className="group flex h-10 items-center gap-2 rounded-lg border border-edge bg-surface-alt px-4 text-sm font-bold text-fg-2 transition-all hover:border-accent hover:text-accent"
          >
            <span
              className={`material-symbols-outlined text-xl transition-transform group-hover:rotate-180 ${isLoading ? "animate-spin" : ""}`}
            >
              refresh
            </span>
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-edge bg-surface p-1">
        {([
          { key: "workflows" as const, label: "Workflows", icon: "account_tree" },
          { key: "runs" as const, label: "Runs", icon: "history", count: activeRuns.length },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch(""); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-accent/15 text-accent border border-accent/30"
                : "text-fg-3 border border-transparent hover:text-fg-2"
            }`}
          >
            <span className="material-symbols-outlined text-lg">{t.icon}</span>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="rounded-full bg-yellow-400/20 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="group relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-fg-4 transition-colors group-focus-within:text-accent">
          <span className="material-symbols-outlined">search</span>
        </div>
        <input
          type="text"
          placeholder={tab === "workflows" ? "> Search workflows..." : "> Search runs..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 w-full rounded-lg border border-edge bg-surface-alt pl-10 pr-4 font-mono text-sm text-fg placeholder-fg-4 transition-all focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Content */}
      {tab === "workflows" ? (
        <>
          {!wfLoading && workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <span className="material-symbols-outlined mb-4 text-5xl text-slate-700">
                account_tree
              </span>
              <p className="mb-1 text-lg font-medium text-fg-3">
                No workflows yet
              </p>
              <p className="text-sm text-fg-4">
                Workflows will appear here once created via the API.
              </p>
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <p className="py-12 text-center text-sm text-fg-4">
              No workflows match your search.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-edge">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-edge bg-surface text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-fg-4">Workflow</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-fg-4">Steps</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-fg-4">Params</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-fg-4 text-right">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {filteredWorkflows.map((wf) => {
                    const icon = workflowIcons[wf.name] || "account_tree";
                    return (
                      <tr
                        key={wf.name}
                        onClick={() => void navigate(`/workflows/${encodeURIComponent(wf.name)}`)}
                        className="group cursor-pointer bg-surface-alt transition-colors hover:bg-accent/5"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-xl text-accent/50 group-hover:text-accent">
                              {icon}
                            </span>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-fg group-hover:text-accent transition-colors">
                                {wf.name}
                              </div>
                              {wf.description && (
                                <p className="mt-0.5 truncate text-xs text-fg-4">
                                  {wf.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            {wf.steps.map((step, i) => (
                              <span key={i} className="flex items-center gap-0.5" title={`${step.name} (${step.type})`}>
                                <span className="material-symbols-outlined text-sm text-fg-4">
                                  {stepTypeIcons[step.type] || "extension"}
                                </span>
                                {i < wf.steps.length - 1 && (
                                  <span className="material-symbols-outlined text-xs text-fg-4/40">
                                    chevron_right
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-mono text-xs text-fg-4">
                            {wf.parameters.filter((p) => p.required).length} required
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {wf.builtin ? (
                            <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                              BUILT-IN
                            </span>
                          ) : (
                            <span className="rounded-full border border-edge px-2 py-0.5 text-[10px] font-bold text-fg-4">
                              CUSTOM
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {!runsLoading && runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <span className="material-symbols-outlined mb-4 text-5xl text-slate-700">
                history
              </span>
              <p className="mb-1 text-lg font-medium text-fg-3">
                No workflow runs yet
              </p>
              <p className="text-sm text-fg-4">
                Runs will appear here once a workflow is executed.
              </p>
            </div>
          ) : filteredRuns.length === 0 ? (
            <p className="py-12 text-center text-sm text-fg-4">
              No runs match your search.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-edge">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-edge bg-surface text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-fg-4">Run ID</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-fg-4">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-fg-4">Workflow</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-fg-4">Error</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-fg-4 text-right">Time</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {filteredRuns.map((run) => (
                    <RunRow
                      key={run.id}
                      run={run}
                      onCancel={() => {
                        cancelRun.mutate(run.id, {
                          onSuccess: () => toast("success", "Run cancellation requested"),
                          onError: (err) => toast("error", `Cancel failed: ${err.message}`),
                        });
                      }}
                      cancelPending={cancelRun.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RunRow({
  run,
  onCancel,
  cancelPending,
}: {
  run: WorkflowRun;
  onCancel: () => void;
  cancelPending: boolean;
}) {
  const sc = runStatusColors[run.status];
  const isActive = run.status === "pending" || run.status === "running";

  return (
    <tr className="group bg-surface-alt transition-colors hover:bg-accent/5">
      <td className="px-4 py-3">
        <Link
          to={`/workflows/runs/${run.id}`}
          className="font-mono text-xs text-accent/60 hover:text-accent transition-colors"
        >
          {run.id.slice(0, 8)}
        </Link>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase ${sc.bg} ${sc.color} ${sc.border}`}
        >
          {run.status === "running" && (
            <span className="size-1.5 animate-pulse rounded-full bg-current" />
          )}
          {run.status}
        </span>
      </td>
      <td className="px-4 py-3">
        <Link
          to={`/workflows/${encodeURIComponent(run.workflow_name)}`}
          className="text-sm text-fg-3 hover:text-accent transition-colors"
        >
          {run.workflow_name}
        </Link>
      </td>
      <td className="px-4 py-3">
        {run.error && (
          <span className="truncate text-xs text-red-400" title={run.error}>
            {run.error.length > 50 ? run.error.slice(0, 50) + "..." : run.error}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <span className="font-mono text-xs text-fg-4">
          {formatTimeAgo(run.created_at)}
        </span>
      </td>
      <td className="px-4 py-3">
        {isActive && (
          <button
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
            disabled={cancelPending}
            className="flex items-center rounded border border-red-900/50 bg-red-900/20 p-1.5 text-red-400 transition-colors hover:bg-red-900/40 disabled:opacity-50"
            title="Cancel run"
          >
            <span className="material-symbols-outlined text-sm">stop</span>
          </button>
        )}
      </td>
    </tr>
  );
}

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
