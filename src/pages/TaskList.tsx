import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { usePageTitle } from "../hooks/usePageTitle";
import { useTasks } from "../hooks/useTasks";
import StatusBadge from "../components/StatusBadge";
import type { Task, TaskStatus } from "../types";

const STATUS_FILTERS: {
  label: string;
  value: TaskStatus | "all";
  icon: string;
}[] = [
  { label: "All", value: "all", icon: "list" },
  { label: "Queued", value: "pending", icon: "hourglass_empty" },
  { label: "Running", value: "running", icon: "play_arrow" },
  { label: "Completed", value: "completed", icon: "check_circle" },
  { label: "Failed", value: "failed", icon: "warning" },
  { label: "Awaiting", value: "awaiting_instruction", icon: "chat_bubble" },
  { label: "PR Created", value: "pr_created", icon: "call_merge" },
];

export default function TaskList() {
  usePageTitle("Tasks");
  const navigate = useNavigate();
  const { data: tasks = [], isLoading, refetch } = useTasks();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");

  const sortedTasks = useMemo(() => {
    return [...tasks].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return sortedTasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.repo_url.toLowerCase().includes(q) ||
          t.prompt.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sortedTasks, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      counts[t.status] = (counts[t.status] || 0) + 1;
    }
    return counts;
  }, [tasks]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-fg">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-fg-3">
            Manage and monitor your AI coding sessions
          </p>
        </div>
        <div className="flex gap-3">
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
          <button
            onClick={() => void navigate("/tasks/new")}
            className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-page shadow-[0_0_15px_rgba(0,255,64,0.3)] transition-colors hover:bg-accent-hover"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            New Task
          </button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="group relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-fg-4 transition-colors group-focus-within:text-accent">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="> Search by ID or prompt..."
            className="h-12 w-full rounded-lg border border-edge bg-surface-alt pl-10 pr-4 font-mono text-sm text-fg placeholder-fg-4 transition-all focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {STATUS_FILTERS.map((f) => {
            const count =
              f.value === "all" ? tasks.length : statusCounts[f.value] ?? 0;
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`flex h-12 items-center gap-2 whitespace-nowrap rounded-lg border px-4 text-sm font-medium transition-colors ${
                  statusFilter === f.value
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-edge bg-surface text-fg-3 hover:border-fg-4 hover:text-fg"
                }`}
              >
                <span className="material-symbols-outlined text-lg">
                  {f.icon}
                </span>
                {f.label}
                {count > 0 && f.value !== "all" && (
                  <span
                    className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${
                      statusFilter === f.value
                        ? "bg-accent/20 text-accent"
                        : "bg-edge text-fg-2"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Task list */}
      {!isLoading && tasks.length === 0 ? (
        <EmptyState onNew={() => void navigate("/tasks/new")} />
      ) : filteredTasks.length === 0 ? (
        <p className="py-12 text-center text-sm text-fg-2">
          No tasks match your filters.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onClick={() => void navigate(`/tasks/${task.id}`)}
            />
          ))}
        </div>
      )}

      {/* Pagination info */}
      {filteredTasks.length > 0 && (
        <div className="flex items-center justify-between border-t border-edge pt-6">
          <span className="text-sm text-fg-4">
            Showing {filteredTasks.length} of {tasks.length} tasks
          </span>
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const repoShort = task.repo_url
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "");

  const isRunning = task.status === "running" || task.status === "cloning";
  const isFailed = task.status === "failed";

  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full flex-col gap-4 rounded-lg border p-5 text-left transition-all duration-300 md:flex-row ${
        isFailed
          ? "border-edge hover:border-red-500/50"
          : "border-edge hover:border-accent/50"
      } bg-surface-alt cursor-pointer overflow-hidden`}
    >
      {/* Left color indicator */}
      {isRunning && (
        <div className="absolute bottom-0 left-0 top-0 w-1 bg-accent" />
      )}
      {isFailed && (
        <div className="absolute bottom-0 left-0 top-0 w-1 bg-red-500/50" />
      )}

      {/* Task ID & timing */}
      <div className="flex min-w-[140px] items-center gap-3 md:flex-col md:items-start md:gap-1">
        <div className="flex items-center gap-2">
          <span
            className={`material-symbols-outlined ${
              isRunning
                ? "animate-pulse text-accent"
                : isFailed
                  ? "text-red-500"
                  : task.status === "completed"
                    ? "text-fg-3"
                    : "text-yellow-500"
            }`}
          >
            {isRunning
              ? "terminal"
              : isFailed
                ? "error"
                : task.status === "completed"
                  ? "check_circle"
                  : "pending"}
          </span>
          <span
            className={`font-mono font-bold tracking-wider ${
              isRunning
                ? "text-accent"
                : isFailed
                  ? "text-red-400"
                  : task.status === "completed"
                    ? "text-fg-3"
                    : "text-fg"
            }`}
          >
            {task.id.slice(0, 8).toUpperCase()}
          </span>
        </div>
        <span className="font-mono text-xs text-fg-4">
          {formatTimeAgo(task.created_at)}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-2 font-mono text-sm text-fg-3">
          <span className="material-symbols-outlined text-base">folder</span>
          <span className="transition-colors hover:text-accent">
            {repoShort}
          </span>
        </div>
        <p
          className={`text-sm font-medium ${
            task.status === "completed"
              ? "text-fg-3"
              : "text-fg"
          }`}
        >
          {task.prompt.length > 150
            ? task.prompt.slice(0, 150) + "..."
            : task.prompt}
        </p>
        {task.error && (
          <p className="mt-1 font-mono text-xs text-red-400">
            &gt; {task.error.slice(0, 100)}
          </p>
        )}
      </div>

      {/* Status + meta */}
      <div className="flex min-w-[120px] items-end justify-between gap-2 md:flex-col md:items-end md:justify-center">
        <StatusBadge status={task.status} />
        <div className="flex items-center gap-2">
          {task.task_type && (
            <span className="rounded border border-fg-4/30 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-fg-4">
              {task.task_type}
            </span>
          )}
          {task.changes_summary && (task.changes_summary.files_modified > 0 || task.changes_summary.files_created > 0 || task.changes_summary.files_deleted > 0) && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-cyan-400/70">
              <span className="material-symbols-outlined text-xs">difference</span>
              {task.changes_summary.diff_stats || `${task.changes_summary.files_modified + task.changes_summary.files_created + task.changes_summary.files_deleted} files`}
            </span>
          )}
          {task.pr_url && (
            <span className="flex items-center gap-0.5 font-mono text-[10px] text-teal-500">
              <span className="material-symbols-outlined text-xs">call_merge</span>
              PR
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <span className="material-symbols-outlined mb-4 text-5xl text-slate-700">
        task
      </span>
      <p className="mb-1 text-lg font-medium text-fg-3">No tasks yet</p>
      <p className="mb-6 text-sm text-fg-4">
        Create your first AI coding task to get started.
      </p>
      <button
        onClick={onNew}
        className="flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-bold text-page shadow-[0_0_15px_rgba(0,255,64,0.3)] transition-colors hover:bg-accent-hover"
      >
        <span className="material-symbols-outlined text-xl">add</span>
        New Task
      </button>
    </div>
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
