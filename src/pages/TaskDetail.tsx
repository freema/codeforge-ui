import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router";
import { Loader2 } from "lucide-react";
import { useTask } from "../hooks/useTask";
import { useTaskStream } from "../hooks/useTaskStream";
import {
  useCancelTask,
  useInstructTask,
  useCreatePR,
  useReviewTask,
} from "../hooks/useTaskMutations";
import StatusBadge from "../components/StatusBadge";
import MarkdownText from "../components/MarkdownText";
import { usePageTitle } from "../hooks/usePageTitle";
import { useToast } from "../context/ToastContext";
import type { TaskStatus, ReviewResult, StreamEvent } from "../types";

const ACTIVE_STATUSES: TaskStatus[] = [
  "pending",
  "cloning",
  "running",
  "reviewing",
  "creating_pr",
  "cancelling",
];

export default function TaskDetail() {
  usePageTitle("Task Detail");
  const { id } = useParams<{ id: string }>();
  const { data: task, isLoading } = useTask(id, "iterations");
  const stream = useTaskStream(id);
  const cancelTask = useCancelTask();
  const instructTask = useInstructTask();
  const createPR = useCreatePR();
  const reviewTask = useReviewTask();
  const { toast } = useToast();

  const [instructPrompt, setInstructPrompt] = useState("");
  const [showPR, setShowPR] = useState(false);
  const [prTitle, setPrTitle] = useState("");
  const [prDesc, setPrDesc] = useState("");
  const [prBranch, setPrBranch] = useState("main");
  const [prError, setPrError] = useState("");
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal to bottom on new events
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [stream.events.length]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent/50" />
      </div>
    );
  }

  if (!task) {
    return (
      <p className="py-20 text-center text-fg-4">Task not found.</p>
    );
  }

  const isActive = ACTIVE_STATUSES.includes(task.status);
  const isPlan = task.task_type === "plan";
  const canCancel = task.status === "running" || task.status === "cloning";
  const canInstruct =
    task.status === "completed" || task.status === "awaiting_instruction";
  const canCreatePR = task.status === "completed" && !task.pr_url && !isPlan;
  const canReview = task.status === "completed" && !isPlan;
  const hasChanges = task.changes_summary &&
    (task.changes_summary.files_modified > 0 ||
     task.changes_summary.files_created > 0 ||
     task.changes_summary.files_deleted > 0);

  const repoShort = task.repo_url
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "");

  async function handleCancel() {
    if (!id) return;
    try {
      await cancelTask.mutateAsync(id);
      toast("info", "Task cancellation requested");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to cancel");
    }
  }

  async function handleInstruct() {
    if (!id || !instructPrompt.trim()) return;
    try {
      await instructTask.mutateAsync({ id, prompt: instructPrompt });
      setInstructPrompt("");
      stream.reconnect();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to send instruction");
    }
  }

  async function handleCreatePR() {
    if (!id) return;
    setPrError("");
    try {
      await createPR.mutateAsync({
        id,
        title: prTitle || undefined,
        description: prDesc || undefined,
        target_branch: prBranch || undefined,
      });
      setShowPR(false);
      toast("success", "Pull request created!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create PR";
      setPrError(msg);
      toast("error", msg);
    }
  }

  async function handleReview() {
    if (!id) return;
    toast("info", "Starting code review...");
    stream.reconnect();
    try {
      await reviewTask.mutateAsync({ id });
      toast("success", "Code review completed!");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Review failed");
    }
  }

  const totalTokens = task.usage
    ? task.usage.input_tokens + task.usage.output_tokens
    : 0;

  return (
    <div className="-m-6 lg:-m-10 flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      {/* Header bar — task info + stats + actions */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-accent/20 bg-surface/80 px-6 py-3 backdrop-blur-sm z-10">
        {/* Left: ID + status + task type + repo */}
        <div className="flex items-center gap-3">
          <span className="rounded border border-accent/30 px-1.5 py-0.5 font-mono text-xs text-accent/70">
            {task.id.slice(0, 8)}
          </span>
          <StatusBadge status={task.status} />
          {task.task_type && (
            <span className="rounded border border-fg-4/30 bg-surface px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-fg-3">
              {task.task_type}
            </span>
          )}
          <span className="hidden sm:flex items-center gap-1.5 font-mono text-xs text-fg-3">
            <span className="material-symbols-outlined text-sm">folder</span>
            {repoShort}
          </span>
        </div>

        {/* Center: stats */}
        <div className="flex items-center gap-4 font-mono text-xs text-fg-3">
          <span title="Tokens">
            <span className="text-fg-4">tok</span>{" "}
            <span className="text-fg">{totalTokens > 0 ? totalTokens.toLocaleString() : "—"}</span>
          </span>
          <span title="Iteration">
            <span className="text-fg-4">iter</span>{" "}
            <span className="text-fg">{task.iteration}</span>
          </span>
          <span title="Duration">
            <span className="text-fg-4">dur</span>{" "}
            <span className="text-fg">{task.usage ? formatDuration(task.usage.duration_seconds) : "—"}</span>
          </span>
          {hasChanges && (
            <span title="Changes" className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-cyan-400">difference</span>
              <span className="text-fg">
                {task.changes_summary!.diff_stats || formatChangesSummary(task.changes_summary!)}
              </span>
            </span>
          )}
          {task.pr_url && (
            <Link
              to={task.pr_url}
              target="_blank"
              className="flex items-center gap-1 text-teal-500 transition-colors hover:text-teal-400"
              title="Pull Request"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="material-symbols-outlined text-sm">call_merge</span>
              PR{task.pr_number ? ` #${task.pr_number}` : ""}
            </Link>
          )}
        </div>

        {/* Right: live/events indicator */}
        <div className="ml-auto flex items-center gap-2">
          {isActive && (
            <div className="flex items-center gap-1.5">
              <div className="size-2 animate-pulse rounded-full bg-accent" />
              <span className="font-mono text-xs uppercase tracking-widest text-accent">Live</span>
            </div>
          )}
          {!isActive && stream.events.length > 0 && (
            <span className="font-mono text-xs text-fg-4">{stream.events.length} events</span>
          )}
          {stream.error && (
            <button
              onClick={stream.reconnect}
              className="font-mono text-xs text-red-400 hover:text-red-300 underline"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {task.error && (
        <div className="flex items-center gap-2 border-b border-red-900/30 bg-red-900/10 px-6 py-2">
          <span className="material-symbols-outlined text-sm text-red-400">error</span>
          <span className="font-mono text-xs text-red-300">{task.error}</span>
        </div>
      )}

      {/* Terminal — full width */}
      <div ref={terminalRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 text-sm">
        {/* Prompt card — always first */}
        <PromptCard prompt={task.prompt} ts={task.created_at} />

        {/* Previous iterations */}
        {task.iterations && task.iterations.length > 1 && (
          <IterationsHistory iterations={task.iterations} />
        )}

        {/* Stream events */}
        {stream.events.length === 0 && isActive ? (
          <div className="flex items-center gap-3 text-fg-4 p-2 mt-2">
            <Loader2 className="h-4 w-4 animate-spin text-accent/50" />
            <span className="italic">Connecting to stream...</span>
          </div>
        ) : stream.events.length > 0 ? (
          <div className="mt-2 space-y-0.5">
            <StreamEvents events={stream.events} isActive={isActive} />
            {isActive && (
              <div className="mt-3 flex items-center gap-2 px-2 text-accent/50">
                <span className="inline-block w-2 animate-pulse bg-accent/60" style={{ height: "14px" }} />
                <span className="text-xs italic">Agent working...</span>
              </div>
            )}
          </div>
        ) : null}

        {/* Post-completion entries */}
        {!isActive && (
          <>
            {task.review_result && (
              <div className="mt-3">
                <ReviewResultCard review={task.review_result} />
              </div>
            )}
            {task.result && !stream.events.some((e) => e.type === "result") && (
              <div className="mt-3 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-sm text-accent">check_circle</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-accent">Result</span>
                </div>
                <MarkdownText text={task.result} className="text-xs" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-edge bg-surface px-4 py-3">
        {/* PR form (inline, above input) */}
        {showPR && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-surface-alt p-2.5">
            <input
              type="text"
              value={prTitle}
              onChange={(e) => setPrTitle(e.target.value)}
              placeholder="PR title (optional)"
              className="min-w-0 flex-1 rounded border border-edge bg-surface px-2 py-1 text-xs text-fg placeholder-fg-4 focus:border-accent focus:outline-none font-mono"
            />
            <input
              type="text"
              value={prBranch}
              onChange={(e) => setPrBranch(e.target.value)}
              placeholder="Target branch"
              className="w-28 rounded border border-edge bg-surface px-2 py-1 text-xs text-fg placeholder-fg-4 focus:border-accent focus:outline-none font-mono"
            />
            <textarea
              value={prDesc}
              onChange={(e) => setPrDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={1}
              className="min-w-0 flex-1 rounded border border-edge bg-surface px-2 py-1 text-xs text-fg placeholder-fg-4 focus:border-accent focus:outline-none font-mono resize-none"
            />
            <button
              onClick={() => void handleCreatePR()}
              disabled={createPR.isPending}
              className="flex items-center gap-1 rounded bg-accent px-2.5 py-1 text-xs font-bold text-page disabled:opacity-50"
            >
              {createPR.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-sm">call_merge</span>
              )}
              {createPR.isPending ? "Creating..." : "Create"}
            </button>
            {prError && (
              <span className="flex w-full items-center gap-1 text-[10px] text-red-400">
                <span className="material-symbols-outlined text-xs">error</span>
                {prError}
              </span>
            )}
          </div>
        )}

        {/* Input row */}
        {canInstruct && (
          <div className="relative mb-2">
            <textarea
              value={instructPrompt}
              onChange={(e) => setInstructPrompt(e.target.value)}
              placeholder="Reply..."
              className="w-full resize-none rounded-lg border border-edge bg-surface-alt py-2 pl-3 pr-10 font-mono text-sm text-fg placeholder-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  void handleInstruct();
                }
              }}
            />
            <button
              onClick={() => void handleInstruct()}
              disabled={instructTask.isPending || !instructPrompt.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md bg-accent text-page transition-opacity disabled:opacity-30"
            >
              {instructTask.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-base">arrow_upward</span>
              )}
            </button>
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {canCancel && (
              <button
                onClick={() => void handleCancel()}
                disabled={cancelTask.isPending}
                className="flex items-center gap-1 text-xs text-red-400 transition-colors hover:text-red-300 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">cancel</span>
                Cancel
              </button>
            )}
            {canReview && (
              <button
                onClick={() => void handleReview()}
                disabled={reviewTask.isPending}
                className="flex items-center gap-1 text-xs text-fg-3 transition-colors hover:text-accent disabled:opacity-50"
              >
                {reviewTask.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-sm">rate_review</span>
                )}
                {reviewTask.isPending ? "Reviewing..." : "Review"}
              </button>
            )}
            {canCreatePR && !showPR && (
              <button
                onClick={() => setShowPR(true)}
                className="flex items-center gap-1 text-xs text-fg-3 transition-colors hover:text-accent"
              >
                <span className="material-symbols-outlined text-sm">call_merge</span>
                Create PR
              </button>
            )}
            {task.pr_url && (
              <Link
                to={task.pr_url}
                target="_blank"
                className="flex items-center gap-1 text-xs text-teal-500 transition-colors hover:text-teal-400"
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                View PR
              </Link>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3 text-[10px] text-fg-4">
            {canInstruct && <span>Cmd+Enter to send</span>}
            {!canInstruct && !isActive && task.status === "completed" && (
              <span className="text-accent/60">Completed</span>
            )}
            {task.status === "failed" && (
              <span className="text-red-400/60">Failed</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Prompt Card (first entry in timeline) ───────────────────────────

function PromptCard({ prompt, ts }: { prompt: string; ts: string }) {
  const time = new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex items-start gap-2.5 px-2 py-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 mt-0.5">
        <span className="material-symbols-outlined text-sm text-accent">person</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-relaxed text-fg whitespace-pre-wrap">{prompt}</p>
      </div>
      <span className="shrink-0 text-[10px] text-fg-4 mt-0.5">{time}</span>
    </div>
  );
}

// ─── Iterations History (collapsible) ────────────────────────────────

function IterationsHistory({
  iterations,
}: {
  iterations: { number: number; prompt: string; result?: string; status: TaskStatus }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const past = iterations.slice(0, -1);

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-surface/30"
      >
        <span className="material-symbols-outlined text-[14px] text-fg-4">history</span>
        <span className="text-xs font-bold text-fg-3">
          {past.length} previous iteration{past.length > 1 ? "s" : ""}
        </span>
        <span
          className="material-symbols-outlined ml-auto text-[14px] text-fg-4 transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
        >
          expand_more
        </span>
      </button>
      {expanded && (
        <div className="ml-4 mt-1 space-y-2 border-l-2 border-edge pl-3">
          {past.map((iter) => (
            <div key={iter.number} className="rounded-lg border border-accent/10 bg-surface/30 p-2.5">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-bold text-accent/70">#{iter.number}</span>
                <StatusBadge status={iter.status} />
              </div>
              <p className="text-xs text-fg-2">{iter.prompt}</p>
              {iter.result && (
                <p className="mt-1 truncate text-xs text-fg-4">{iter.result}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stream events with plan aggregation ─────────────────────────────

/** Helper: extract TodoWrite todos from a stream event, or null */
function extractTodoWrite(event: StreamEvent): Array<{ content: string; status: string }> | null {
  const data = event.data as Record<string, unknown> | string;
  if (typeof data !== "object" || data === null) return null;
  if (data.type !== "tool_use") return null;
  const raw = data.raw as Record<string, unknown> | undefined;
  if (!raw) return null;
  // Check raw.message.content[0].name === "TodoWrite"
  const message = raw.message as Record<string, unknown> | undefined;
  const contentArr = (message?.content ?? raw.content) as Array<Record<string, unknown>> | undefined;
  if (!contentArr || !Array.isArray(contentArr)) return null;
  const block = contentArr.find((c) => c.name === "TodoWrite");
  if (!block) return null;
  const input = block.input as Record<string, unknown> | undefined;
  return (input?.todos as Array<{ content: string; status: string }>) ?? null;
}

function StreamEvents({ events, isActive }: { events: StreamEvent[]; isActive: boolean }) {
  // Find all TodoWrite event indices and compute latest plan state
  const planData = useMemo(() => {
    const indices: number[] = [];
    let latestTodos: Array<{ content: string; status: string }> | null = null;

    for (let i = 0; i < events.length; i++) {
      const todos = extractTodoWrite(events[i]!);
      if (todos) {
        indices.push(i);
        latestTodos = todos;
      }
    }

    return { todoWriteIndices: new Set(indices), latestTodos, firstIndex: indices[0] ?? -1 };
  }, [events]);

  return (
    <>
      {events.map((event, i) => {
        // TodoWrite events: show the plan block at the FIRST occurrence, skip the rest
        if (planData.todoWriteIndices.has(i)) {
          if (i === planData.firstIndex && planData.latestTodos) {
            return <PlanProgressBlock key={i} todos={planData.latestTodos} isActive={isActive} />;
          }
          return null; // skip subsequent TodoWrite events
        }
        return <TerminalEvent key={i} event={event} />;
      })}
    </>
  );
}

// ─── Plan Progress Block ─────────────────────────────────────────────

function PlanProgressBlock({
  todos,
  isActive,
}: {
  todos: Array<{ content: string; status: string }>;
  isActive: boolean;
}) {
  const completed = todos.filter((t) => t.status === "completed").length;
  const inProgress = todos.filter((t) => t.status === "in_progress").length;
  const total = todos.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="my-2 rounded-lg border border-accent/20 bg-accent/[0.03] overflow-hidden">
      {/* Header with progress */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-accent/10">
        <span className="material-symbols-outlined text-base text-accent">checklist</span>
        <span className="text-xs font-bold uppercase tracking-wider text-accent">Plan</span>
        <span className="ml-auto font-mono text-[10px] text-fg-3">
          {completed}/{total}
        </span>
        {/* Mini progress bar */}
        <div className="w-20 h-1.5 rounded-full bg-accent/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct === 100 && (
          <span className="material-symbols-outlined text-sm text-accent">done_all</span>
        )}
        {pct < 100 && isActive && inProgress > 0 && (
          <Loader2 className="h-3 w-3 animate-spin text-accent/60" />
        )}
      </div>

      {/* Todo items */}
      <div className="px-3 py-1.5">
        {todos.map((todo, i) => {
          const isCompleted = todo.status === "completed";
          const isInProg = todo.status === "in_progress";
          return (
            <div
              key={i}
              className={`flex items-center gap-2 py-1 ${isCompleted ? "text-fg-4" : isInProg ? "text-accent" : "text-fg-3"}`}
            >
              {isCompleted ? (
                <span className="material-symbols-outlined text-sm text-accent/60">check_circle</span>
              ) : isInProg ? (
                <span className="material-symbols-outlined text-sm text-accent animate-pulse">pending</span>
              ) : (
                <span className="material-symbols-outlined text-sm text-fg-4/50">radio_button_unchecked</span>
              )}
              <span className={`text-xs ${isCompleted ? "line-through opacity-60" : ""}`}>
                {todo.content}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Terminal event rendering ────────────────────────────────────────

function TerminalEvent({ event }: { event: StreamEvent }) {
  const data = event.data as Record<string, unknown> | string;
  const dataType = typeof data === "object" && data !== null ? (data.type as string) : null;
  const content = typeof data === "string" ? data : getContent(data);
  const raw = typeof data === "object" && data !== null ? (data.raw as Record<string, unknown> | undefined) : undefined;

  const ts = event.ts
    ? new Date(event.ts).toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

  // System-level events (clone, cli_started, review_started, etc.)
  if (event.type === "system") {
    const msg = formatSystemEvent(event.event, data);
    if (!msg) return null;
    return (
      <div className="flex items-start gap-2 rounded px-2 py-1.5 bg-accent/5">
        <span className="w-14 shrink-0 font-mono text-[10px] text-fg-4 pt-0.5">{ts}</span>
        <span className="material-symbols-outlined text-[14px] text-accent/70 mt-0.5">info</span>
        <span className="text-xs text-accent/80">{msg}</span>
      </div>
    );
  }

  // Git events
  if (event.type === "git") {
    const msg = formatSystemEvent(event.event, data);
    if (!msg) return null;
    return (
      <div className="flex items-start gap-2 rounded px-2 py-1.5 bg-cyan-400/5">
        <span className="w-14 shrink-0 font-mono text-[10px] text-fg-4 pt-0.5">{ts}</span>
        <span className="material-symbols-outlined text-[14px] text-cyan-400/70 mt-0.5">commit</span>
        <span className="text-xs text-cyan-400/80">{msg}</span>
      </div>
    );
  }

  // Result event — just a status marker, content is already in text events above
  if (event.type === "result") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded px-2 py-1.5 bg-accent/5">
        <span className="w-14 shrink-0 font-mono text-[10px] text-fg-4 pt-0.5">{ts}</span>
        <span className="material-symbols-outlined text-[14px] text-accent">check_circle</span>
        <span className="text-xs font-bold text-accent">Task completed</span>
      </div>
    );
  }

  // Stream events — the main agent output
  if (event.type === "stream") {
    // Tool use — agent calling a tool
    if (dataType === "tool_use") {
      const toolInfo = extractToolFromRaw(raw);
      const toolName = toolInfo.name ?? extractToolName(content);
      const toolInput = toolInfo.input;
      const toolContent = formatToolExpandedContent(toolName, toolInput);
      const n = toolName.toLowerCase();
      const showExpanded = (n === "write" || (n.includes("write") && n !== "todowrite")) || n === "edit" || n.includes("edit") || n === "multiedit" || n.includes("multiedit");
      return (
        <ToolUseBlock ts={ts} toolName={toolName} toolInput={toolInput} content={toolContent} defaultExpanded={showExpanded} />
      );
    }

    // Tool result — response from tool
    if (dataType === "tool_result") {
      // Codex command_execution: render as self-contained Bash block
      const itemType = raw?.item as Record<string, unknown> | undefined;
      if (itemType?.type === "command_execution") {
        const cmd = (itemType.command as string) ?? content;
        const exitCode = itemType.exit_code as number | undefined;
        const shortCmd = cmd.replace(/^\/bin\/sh\s+-lc\s+/, "").replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
        return (
          <div className="flex items-center gap-2 rounded px-2 py-1.5">
            <span className="w-14 shrink-0 font-mono text-[10px] text-fg-4">{ts}</span>
            <span className="material-symbols-outlined text-[14px] text-purple-400">terminal</span>
            <span className="text-xs font-bold text-purple-400">Bash</span>
            <span className="flex-1 min-w-0 truncate text-xs text-fg-3 font-mono">{shortCmd}</span>
            {exitCode != null && (
              <span className={`font-mono text-[10px] ${exitCode === 0 ? "text-accent/60" : "text-red-400"}`}>
                exit {exitCode}
              </span>
            )}
          </div>
        );
      }
      const resultText = extractToolResultContent(raw, content);
      return (
        <ToolResultBlock content={resultText} />
      );
    }

    // Thinking — agent's reasoning
    if (dataType === "thinking") {
      return <ThinkingBlock ts={ts} content={content} />;
    }

    // Error
    if (dataType === "error") {
      return (
        <div className="flex items-start gap-2 rounded px-2 py-1.5 bg-red-500/5">
          <span className="w-14 shrink-0 font-mono text-[10px] text-fg-4 pt-0.5">{ts}</span>
          <span className="material-symbols-outlined text-[14px] text-red-400 mt-0.5">error</span>
          <span className="text-xs text-red-400 whitespace-pre-wrap break-words">{content}</span>
        </div>
      );
    }

    // Text — agent speaking
    if (dataType === "text" || dataType === "result") {
      if (!content) return null;
      return (
        <div className="flex items-start gap-2 px-2 py-1">
          <span className="w-14 shrink-0 font-mono text-[10px] text-fg-4 pt-0.5">{ts}</span>
          <div className="min-w-0 flex-1">
            <MarkdownText text={content} className="text-xs" />
          </div>
        </div>
      );
    }

    // System message from stream (init, config, etc.)
    if (dataType === "system") {
      const msg = formatStreamSystemEvent(data as Record<string, unknown>);
      if (!msg) return null; // hide noisy system events with no useful info
      return (
        <div className="flex items-start gap-2 rounded px-2 py-1.5 bg-accent/5">
          <span className="w-14 shrink-0 font-mono text-[10px] text-fg-4 pt-0.5">{ts}</span>
          <span className="material-symbols-outlined text-[14px] text-accent/70 mt-0.5">info</span>
          <span className="text-xs text-accent/80">{msg}</span>
        </div>
      );
    }

    // Default / unknown stream sub-type — skip if content looks like raw JSON
    if (content.startsWith("{") && content.length > 200) return null;
    return (
      <div className="flex items-start gap-2 px-2 py-0.5">
        <span className="w-14 shrink-0 font-mono text-[10px] text-fg-4 pt-0.5">{ts}</span>
        <span className="min-w-0 flex-1 text-xs text-fg-3 whitespace-pre-wrap break-words">{content}</span>
      </div>
    );
  }

  // Fallback for any other event type — skip raw JSON dumps
  if (content.startsWith("{") && content.length > 200) return null;
  return (
    <div className="flex items-start gap-2 px-2 py-0.5">
      <span className="w-14 shrink-0 font-mono text-[10px] text-fg-4 pt-0.5">{ts}</span>
      <span className="text-[10px] font-bold text-fg-4 uppercase mt-0.5">[{event.type}]</span>
      <span className="min-w-0 flex-1 text-xs text-fg-3 whitespace-pre-wrap break-words">{content}</span>
    </div>
  );
}

// ─── Tool Use block ──────────────────────────────────────────────────

function ToolUseBlock({
  ts,
  toolName,
  toolInput,
  content,
  defaultExpanded = false,
}: {
  ts: string;
  toolName: string;
  toolInput?: Record<string, unknown>;
  content: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const isMCP = toolName.startsWith("mcp__");
  const { icon, label, detail } = getToolDisplay(toolName, toolInput, content);
  const hasContent = content.length > 0;
  const isEdit = toolName.toLowerCase() === "edit" || toolName.toLowerCase().includes("edit");
  const mcpColor = isMCP ? "text-cyan-400" : "text-purple-400";

  return (
    <div className="mt-1 mb-0.5">
      <button
        onClick={() => hasContent && setExpanded(!expanded)}
        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors ${hasContent ? (isMCP ? "hover:bg-cyan-500/5" : "hover:bg-purple-500/5") + " cursor-pointer" : "cursor-default"}`}
      >
        <span className="w-14 shrink-0 font-mono text-[10px] text-fg-4">{ts}</span>
        <span className={`material-symbols-outlined text-[14px] ${mcpColor}`}>
          {icon}
        </span>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {isMCP && (
            <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-400">
              MCP
            </span>
          )}
          <span className={`text-xs font-bold ${mcpColor}`}>{label}</span>
          {detail && (
            <span className="truncate text-xs text-fg-3 font-mono">{detail}</span>
          )}
        </div>
        {hasContent && (
          <span className="material-symbols-outlined text-[14px] text-fg-4 transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>
            expand_more
          </span>
        )}
      </button>
      {expanded && content && (
        <div className={`ml-[72px] mr-2 mb-1 rounded-b border-l-2 overflow-x-auto ${isMCP ? "border-cyan-500/30 bg-cyan-500/5" : "border-purple-500/30 bg-purple-500/5"}`}>
          {isEdit ? (
            <DiffContent content={content} />
          ) : (
            <pre className="p-3 text-[11px] font-mono text-fg-3 whitespace-pre-wrap break-words leading-relaxed">{content}</pre>
          )}
        </div>
      )}
    </div>
  );
}

/** Render diff-style content with red/green coloring */
function DiffContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="p-3 text-[11px] font-mono leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("+ ")) {
          return <div key={i} className="text-accent/90 bg-accent/5 px-1 -mx-1 rounded-sm">{line}</div>;
        }
        if (line.startsWith("- ")) {
          return <div key={i} className="text-red-400/90 bg-red-400/5 px-1 -mx-1 rounded-sm">{line}</div>;
        }
        return <div key={i} className="text-fg-4">{line}</div>;
      })}
    </div>
  );
}

// ─── Tool Result block (subordinate to tool_use above) ──────────────

function ToolResultBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!content || content === "(tool output too large to display)") return null;

  const lineCount = content.split("\n").length;

  // Short results (few lines): show inline, no expand needed
  if (lineCount <= 4) {
    return (
      <div className="ml-[72px] mr-2 mb-1 rounded border-l-2 border-fg-4/20 bg-surface/30 px-3 py-1.5">
        <pre className="font-mono text-[11px] text-fg-4 whitespace-pre-wrap break-words leading-relaxed">{content}</pre>
      </div>
    );
  }

  // Long results: collapsed by default, expandable
  const preview = content.split("\n").slice(0, 3).join("\n");

  return (
    <div className="ml-[72px] mr-2 mb-1 rounded border-l-2 border-fg-4/20 bg-surface/30 overflow-hidden">
      <pre className="px-3 py-1.5 font-mono text-[11px] text-fg-4 whitespace-pre-wrap break-words leading-relaxed">
        {expanded ? content : preview}
      </pre>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1 border-t border-edge/50 px-3 py-1 text-[10px] text-purple-400 hover:bg-purple-500/5 transition-colors"
      >
        <span className="material-symbols-outlined text-xs">{expanded ? "expand_less" : "expand_more"}</span>
        {expanded ? "Collapse" : `Show all (${lineCount} lines)`}
      </button>
    </div>
  );
}

// ─── Thinking block ─────────────────────────────────────────────────

function ThinkingBlock({ ts, content }: { ts: string; content: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = content.length > 100 ? content.slice(0, 100) + "..." : content;

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-surface/30"
      >
        <span className="w-14 shrink-0 font-mono text-[10px] text-fg-4 pt-0.5">{ts}</span>
        <span className="material-symbols-outlined text-[14px] text-fg-4 mt-0.5 italic">psychology</span>
        <span className="flex-1 text-[11px] text-fg-4 italic truncate">
          {expanded ? "" : preview}
        </span>
        <span className="material-symbols-outlined text-[12px] text-fg-4" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>
          expand_more
        </span>
      </button>
      {expanded && (
        <div className="ml-[72px] mr-2 mb-1 rounded border-l-2 border-edge bg-surface/20 px-3 py-2 overflow-x-auto">
          <pre className="font-mono text-[11px] text-fg-4 italic whitespace-pre-wrap break-words leading-relaxed">{content}</pre>
        </div>
      )}
    </div>
  );
}

// ─── Review Result Card ─────────────────────────────────────────────

function ReviewResultCard({ review }: { review: ReviewResult }) {
  const verdictColors = {
    approve: "text-accent border-accent/30 bg-accent/10",
    request_changes: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    comment: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  };

  const severityColors = {
    critical: "text-red-400 bg-red-900/20 border-red-900/30",
    major: "text-orange-400 bg-orange-900/20 border-orange-900/30",
    minor: "text-yellow-400 bg-yellow-900/20 border-yellow-900/30",
    suggestion: "text-blue-400 bg-blue-900/20 border-blue-900/30",
  };

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg-2">
        <span className="material-symbols-outlined text-blue-400 text-base">rate_review</span>
        Code Review
      </h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${verdictColors[review.verdict]}`}>
            {review.verdict.replace("_", " ")}
          </span>
          <span className="font-mono text-sm text-fg">
            Score: <span className="text-accent font-bold">{review.score}</span>/10
          </span>
        </div>

        <p className="text-sm text-fg-2">{review.summary}</p>

        {review.issues && review.issues.length > 0 && (
          <div className="space-y-2">
            {review.issues.map((issue, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 ${severityColors[issue.severity]}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase">{issue.severity}</span>
                  <span className="font-mono text-xs text-fg-3">
                    {issue.file}{issue.line ? `:${issue.line}` : ""}
                  </span>
                </div>
                <p className="text-sm">{issue.description}</p>
                {issue.suggestion && (
                  <p className="mt-1 text-xs text-fg-3">
                    Suggestion: {issue.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-fg-4">
          Reviewed by {review.reviewed_by} in {review.duration_seconds.toFixed(1)}s
        </p>
      </div>
    </div>
  );
}

// ─── Helper functions ───────────────────────────────────────────────

function getContent(data: Record<string, unknown> | null): string {
  if (!data) return "";
  if (typeof data.content === "string") return data.content;
  if (typeof data.message === "string") return data.message;
  if (typeof data.text === "string") return data.text;
  if (typeof data.result === "string") return data.result;
  if (typeof data.error === "string") return data.error;
  return "";
}

/** Known noisy system events with no useful content */
const HIDDEN_SYSTEM_EVENTS = new Set(["user", "heartbeat", "ping", "ack"]);

function formatSystemEvent(eventName: string, data: unknown): string | null {
  if (HIDDEN_SYSTEM_EVENTS.has(eventName)) return null;

  const obj = typeof data === "object" && data !== null ? data as Record<string, unknown> : {};
  switch (eventName) {
    case "cli_started":
      return `Agent started (${obj.cli ?? "cli"}, iteration ${obj.iteration ?? "?"})`;
    case "clone_started":
      return `Cloning ${obj.repo_url ?? "repository"}...`;
    case "clone_completed":
      return `Clone complete → ${obj.work_dir ?? "workspace"}`;
    case "task_timeout":
      return `Task timed out after ${obj.timeout_seconds ?? "?"}s`;
    case "task_cancelled":
      return "Task cancelled";
    case "task_failed":
      return `Task failed: ${obj.error ?? "unknown error"}`;
    case "review_started":
      return "Code review started...";
    case "review_completed": {
      const verdict = obj.verdict as string | undefined;
      const score = obj.score as number | undefined;
      return `Review complete: ${verdict ?? "?"} (score: ${score ?? "?"}/10, ${obj.issues_count ?? 0} issues)`;
    }
    default: {
      const msg = getContent(obj);
      if (msg.startsWith("{") || msg.startsWith("[")) return null;
      return msg || null;
    }
  }
}

/** Known noisy stream subtypes to hide */
const HIDDEN_STREAM_SUBTYPES = new Set([
  "user", "heartbeat", "ping", "ack", "result",
  // Codex-specific internal events
  "thread.started", "thread.completed", "turn.started", "turn.completed",
  "item.completed", "item.started", "item.created", "item.updated",
]);

/** Format stream system events (init, config, etc.) into readable text */
function formatStreamSystemEvent(data: Record<string, unknown>): string | null {
  const raw = data.raw as Record<string, unknown> | undefined;
  const cli = data.cli as string | undefined;
  const subtype = raw?.subtype as string | undefined ?? raw?.type as string | undefined;

  if (subtype && HIDDEN_STREAM_SUBTYPES.has(subtype)) return null;

  if (subtype === "init" || subtype === "system") {
    const model = raw?.model as string | undefined;
    const cwd = raw?.cwd as string | undefined;
    const parts = [`Agent started`];
    if (cli) parts[0] = `${cli} started`;
    if (model) parts.push(`model: ${model}`);
    if (cwd) {
      const short = cwd.split("/").slice(-2).join("/");
      parts.push(`in ${short}`);
    }
    return parts.join(" · ");
  }

  if (subtype === "config" || subtype === "settings") {
    return null; // hide config noise
  }

  // For other subtypes, try to extract a readable message
  if (raw) {
    if (typeof raw.message === "string") return raw.message;
    if (typeof raw.text === "string") return raw.text;
  }

  // If we have a subtype, show it as a label
  if (subtype) return subtype.replace(/_/g, " ");

  return null; // hide unrecognizable system events
}

/** Format tool expanded content based on tool type — not raw JSON */
function formatToolExpandedContent(toolName: string, toolInput?: Record<string, unknown>): string {
  if (!toolInput) return "";
  const name = toolName.toLowerCase();

  // TodoWrite: show the todo items as a checklist
  if (name === "todowrite") {
    const todos = toolInput.todos as Array<{ content: string; status: string }> | undefined;
    if (todos && todos.length > 0) {
      return todos
        .map((t) => {
          const icon = t.status === "completed" ? "[x]" : t.status === "in_progress" ? "[~]" : "[ ]";
          return `${icon} ${t.content}`;
        })
        .join("\n");
    }
    return "";
  }

  // Write: show file content being written
  if (name === "write" || name.includes("write")) {
    const fileContent = toolInput.content as string | undefined;
    if (fileContent) {
      const preview = fileContent.length > 1000 ? fileContent.slice(0, 1000) + "\n..." : fileContent;
      return preview;
    }
    return "";
  }

  // Edit: show old → new
  if (name === "edit" || name.includes("edit")) {
    const oldStr = toolInput.old_string as string | undefined;
    const newStr = toolInput.new_string as string | undefined;
    if (oldStr && newStr) {
      const lines: string[] = [];
      for (const line of oldStr.split("\n")) lines.push(`- ${line}`);
      for (const line of newStr.split("\n")) lines.push(`+ ${line}`);
      return lines.join("\n");
    }
    return "";
  }

  // Bash: show full command (header may truncate it)
  if (name === "bash" || name.includes("bash") || name.includes("shell")) {
    const cmd = toolInput.command as string | undefined;
    return cmd ?? "";
  }

  // Read/Grep/Glob/LS: detail is already in header, nothing extra needed
  if (name === "read" || name.includes("read") ||
      name === "grep" || name.includes("grep") || name.includes("search") ||
      name === "glob" || name.includes("glob") || name.includes("find") ||
      name === "ls" || name === "listdir") {
    return "";
  }

  // Fallback: show input params but truncate long values
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(toolInput)) {
    if (typeof value === "string" && value.length > 200) {
      cleaned[key] = value.slice(0, 200) + "...";
    } else {
      cleaned[key] = value;
    }
  }
  return JSON.stringify(cleaned, null, 2);
}

function extractToolName(content: string): string {
  // Try to extract tool name from content like "Running: Read file ..." or "Tool: Bash ..."
  const match = content.match(/^(?:Running|Tool|Using):\s*(\w+)/i);
  if (match?.[1]) return match[1];
  // Codex format: "tool_name({...})" or just "tool_name"
  const codexMatch = content.match(/^(\w+)(?:\(|$)/);
  return codexMatch?.[1] ?? "Tool";
}

/** Extract tool name + input from the nested raw API response */
function extractToolFromRaw(raw: Record<string, unknown> | undefined): { name?: string; input?: Record<string, unknown> } {
  if (!raw) return {};

  // Direct: raw.name, raw.input (simple format)
  if (typeof raw.name === "string") {
    return { name: raw.name, input: raw.input as Record<string, unknown> | undefined };
  }

  // Nested in raw.message.content[0] (full API response format)
  const message = raw.message as Record<string, unknown> | undefined;
  if (message) {
    const msgContent = message.content as Array<Record<string, unknown>> | undefined;
    if (msgContent && msgContent.length > 0) {
      const first = msgContent[0]!;
      if (typeof first.name === "string") {
        return { name: first.name, input: first.input as Record<string, unknown> | undefined };
      }
    }
  }

  // Nested in raw.content[0] (alternate format)
  const content = raw.content as Array<Record<string, unknown>> | undefined;
  if (content && content.length > 0) {
    const first = content[0]!;
    if (typeof first.name === "string") {
      return { name: first.name, input: first.input as Record<string, unknown> | undefined };
    }
  }

  // Codex format: raw = { type: "item.completed", item: { type: "function_call", name: "read_file", arguments: "{...}" } }
  const item = raw.item as Record<string, unknown> | undefined;
  if (item && typeof item.name === "string") {
    let input: Record<string, unknown> | undefined;
    if (typeof item.arguments === "string" && item.arguments) {
      try { input = JSON.parse(item.arguments as string) as Record<string, unknown>; } catch { /* ignore */ }
    }
    return { name: item.name, input };
  }

  return {};
}

/** Extract meaningful text from tool_result, avoiding full JSON dump */
function extractToolResultContent(raw: Record<string, unknown> | undefined, fallback: string): string {
  if (raw) {
    // Direct content string
    if (typeof raw.content === "string") return raw.content;
    if (typeof raw.text === "string") return raw.text;
    if (typeof raw.result === "string") return raw.result;
    if (typeof raw.output === "string") return raw.output;

    // Nested in raw.message.content[0].text
    const message = raw.message as Record<string, unknown> | undefined;
    if (message) {
      const msgContent = message.content as Array<Record<string, unknown>> | undefined;
      if (msgContent && msgContent.length > 0) {
        const texts = msgContent
          .map((c) => (typeof c.text === "string" ? c.text : typeof c.content === "string" ? c.content : null))
          .filter(Boolean);
        if (texts.length > 0) return texts.join("\n");
      }
    }

    // Nested in raw.content array
    const content = raw.content as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(content) && content.length > 0) {
      const texts = content
        .map((c) => (typeof c.text === "string" ? c.text : null))
        .filter(Boolean);
      if (texts.length > 0) return texts.join("\n");
    }
  }

  // If fallback looks like a full JSON dump, don't show it
  if (fallback.startsWith("{") && fallback.length > 300) {
    return "(tool output too large to display)";
  }

  return fallback;
}

function getToolDisplay(
  toolName: string,
  toolInput?: Record<string, unknown>,
  content?: string,
): { icon: string; label: string; detail: string } {
  const name = toolName.toLowerCase();
  const filePath = (toolInput?.file_path as string | undefined) ?? (toolInput?.path as string | undefined);
  const command = toolInput?.command as string | undefined;

  if (name === "read" || name.includes("read")) {
    return { icon: "description", label: "Read", detail: filePath ?? "" };
  }
  if (name === "todowrite") {
    const todos = toolInput?.todos as Array<{ content: string; status: string }> | undefined;
    const count = todos?.length ?? 0;
    return { icon: "checklist", label: "Plan", detail: count > 0 ? `${count} items` : "" };
  }
  if (name === "write" || name.includes("write")) {
    const fileContent = toolInput?.content as string | undefined;
    const lineCount = fileContent ? fileContent.split("\n").length : 0;
    const suffix = lineCount > 0 ? ` (${lineCount} lines)` : "";
    return { icon: "edit_document", label: "Write", detail: (filePath ?? "") + suffix };
  }
  if (name === "edit" || name.includes("edit")) {
    const oldStr = toolInput?.old_string as string | undefined;
    const newStr = toolInput?.new_string as string | undefined;
    const oldLines = oldStr ? oldStr.split("\n").length : 0;
    const newLines = newStr ? newStr.split("\n").length : 0;
    const suffix = oldStr ? ` (-${oldLines} +${newLines})` : "";
    return { icon: "edit", label: "Edit", detail: (filePath ?? "") + suffix };
  }
  if (name === "bash" || name.includes("bash") || name.includes("shell")) {
    const cmd = command ? (command.length > 80 ? command.slice(0, 80) + "..." : command) : "";
    return { icon: "terminal", label: "Bash", detail: cmd };
  }
  if (name === "grep" || name.includes("grep") || name.includes("search")) {
    const pattern = toolInput?.pattern as string | undefined;
    return { icon: "search", label: "Search", detail: pattern ?? "" };
  }
  if (name === "glob" || name.includes("glob") || name.includes("find")) {
    const pattern = toolInput?.pattern as string | undefined;
    return { icon: "folder_open", label: "Glob", detail: pattern ?? "" };
  }
  if (name === "ls" || name === "listdir") {
    const path = (toolInput?.path as string | undefined) ?? filePath ?? "";
    return { icon: "folder_open", label: "LS", detail: path };
  }
  // MCP tools: mcp__servername__toolname
  if (toolName.startsWith("mcp__")) {
    const parts = toolName.split("__");
    const serverName = parts[1] ?? "";
    const mcpToolName = parts.slice(2).join("__") || toolName;
    return { icon: "dns", label: mcpToolName, detail: serverName };
  }

  // Fallback: show tool name, but never raw JSON as detail
  const fallbackDetail = content && content.length <= 100 && !content.startsWith("{") && !content.startsWith("[") ? content : "";
  return { icon: "build", label: toolName, detail: fallbackDetail };
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m > 0) return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function formatChangesSummary(c: { files_modified: number; files_created: number; files_deleted: number }): string {
  const parts: string[] = [];
  if (c.files_modified > 0) parts.push(`${c.files_modified} mod`);
  if (c.files_created > 0) parts.push(`${c.files_created} new`);
  if (c.files_deleted > 0) parts.push(`${c.files_deleted} del`);
  return parts.join(", ");
}
