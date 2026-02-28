import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { usePageTitle } from "../hooks/usePageTitle";
import { useWorkflows } from "../hooks/useWorkflows";
import type { WorkflowDefinition } from "../types";

export default function WorkflowList() {
  usePageTitle("Workflows");
  const navigate = useNavigate();
  const { data: workflows = [], isLoading, refetch } = useWorkflows();
  const [search, setSearch] = useState("");

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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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

      {/* Search */}
      <div className="group relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-fg-4 transition-colors group-focus-within:text-accent">
          <span className="material-symbols-outlined">search</span>
        </div>
        <input
          type="text"
          placeholder="> Search workflows..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 w-full rounded-lg border border-edge bg-surface-alt pl-10 pr-4 font-mono text-sm text-fg placeholder-fg-4 transition-all focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Workflow List */}
      {!isLoading && workflows.length === 0 ? (
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
        <div className="flex flex-col gap-3">
          {filteredWorkflows.map((wf) => (
            <WorkflowRow
              key={wf.name}
              workflow={wf}
              onClick={() =>
                void navigate(
                  `/workflows/${encodeURIComponent(wf.name)}`,
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowRow({
  workflow,
  onClick,
}: {
  workflow: WorkflowDefinition;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-lg border border-edge bg-surface-alt p-5 text-left transition-all duration-300 hover:border-accent/50"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface border border-edge group-hover:border-accent/30">
        <span className="material-symbols-outlined text-accent/60 group-hover:text-accent">
          account_tree
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-fg">
            {workflow.name}
          </span>
          {workflow.builtin && (
            <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
              BUILT-IN
            </span>
          )}
        </div>
        {workflow.description && (
          <p className="mt-1 truncate text-sm text-fg-3">
            {workflow.description}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="rounded border border-edge px-2 py-0.5 font-mono text-[10px] text-fg-3">
          {workflow.steps.length} step{workflow.steps.length !== 1 ? "s" : ""}
        </span>
        {workflow.parameters.length > 0 && (
          <span className="rounded border border-edge px-2 py-0.5 font-mono text-[10px] text-fg-4">
            {workflow.parameters.length} param{workflow.parameters.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </button>
  );
}
