import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import { useKeys } from "../hooks/useKeys";
import { useRepositories } from "../hooks/useRepositories";
import {
  useSentryOrganizations,
  useSentryProjects,
  useSentryIssues,
  useFixSentryIssue,
} from "../hooks/useSentry";
import { useWorkflowRunStream } from "../hooks/useWorkflowRuns";
import Select from "./Select";
import type { SentryConfig, SentryIssue } from "../types";

const STORAGE_KEY = "sentry-config";

function loadConfig(): SentryConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as SentryConfig;
    if (cfg.key_name && cfg.org_slug && cfg.project_slug && cfg.repo_url) return cfg;
    return null;
  } catch {
    return null;
  }
}

type FixMode = "single" | "batch" | "all";
type IssueSort = "freq" | "date" | "new" | "priority";

const LEVEL_COLORS: Record<string, string> = {
  fatal: "bg-red-500",
  error: "bg-orange-500",
  warning: "bg-yellow-500",
  info: "bg-blue-500",
};

export default function SentryFixerRunForm() {
  const navigate = useNavigate();
  const { data: allKeys } = useKeys();
  const config = loadConfig();

  // ── Sentry key ──
  const sentryKeys = useMemo(
    () => allKeys?.filter((k) => k.provider === "sentry") ?? [],
    [allKeys],
  );
  const [sentryKey, setSentryKey] = useState(config?.key_name ?? "");
  const effectiveKey = sentryKey || (sentryKeys.length === 1 ? sentryKeys[0]!.name : "");

  // ── Organizations (fetched from API) ──
  const { data: orgs, isLoading: orgsLoading } = useSentryOrganizations(effectiveKey || undefined);
  const [orgSlug, setOrgSlug] = useState(config?.org_slug ?? "");
  // Auto-select if only one org
  const effectiveOrg = orgSlug || (orgs?.length === 1 ? orgs[0]!.slug : "");

  // ── Projects (fetched once org is picked) ──
  const { data: sentryProjects, isLoading: projectsLoading } = useSentryProjects(
    effectiveKey || undefined,
    effectiveOrg || undefined,
  );
  const [projectSlug, setProjectSlug] = useState(config?.project_slug ?? "");

  // ── Git provider + repo ──
  const gitKeys = useMemo(
    () => allKeys?.filter((k) => k.provider === "github" || k.provider === "gitlab") ?? [],
    [allKeys],
  );
  const [gitKey, setGitKey] = useState(config?.provider_key ?? "");
  const effectiveGitKey = gitKey || (gitKeys.length === 1 ? gitKeys[0]!.name : "");
  const { data: repos, isLoading: reposLoading } = useRepositories(effectiveGitKey || undefined);
  const [repoUrl, setRepoUrl] = useState(config?.repo_url ?? "");

  // ── Fix mode ──
  const [fixMode, setFixMode] = useState<FixMode>("single");

  // ── Issues ──
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<IssueSort>("freq");
  const sortParam = sort === "freq" ? "freq" : sort === "new" ? "new" : sort === "priority" ? "priority" : "date";

  const { data: issues, isLoading: issuesLoading } = useSentryIssues(
    effectiveKey || undefined,
    effectiveOrg || undefined,
    projectSlug || undefined,
    { query: search ? `is:unresolved ${search}` : "is:unresolved", sort: sortParam },
  );

  // ── Selection ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleBatch = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Run logic ──
  const fixIssue = useFixSentryIssue();
  const [fixingIds, setFixingIds] = useState<Map<string, string>>(new Map());
  const [isRunning, setIsRunning] = useState(false);

  const configComplete = !!(effectiveKey && effectiveOrg && projectSlug && repoUrl);

  const canRun =
    configComplete &&
    (fixMode === "all" ||
      (fixMode === "single" && selectedId) ||
      (fixMode === "batch" && selectedIds.size > 0));

  function buildParams(issueId: string) {
    return {
      name: "sentry-fixer",
      params: {
        sentry_url: "https://sentry.io",
        issue_id: issueId,
        repo_url: repoUrl,
        key_name: effectiveKey,
        ...(effectiveGitKey ? { provider_key: effectiveGitKey } : {}),
      },
    };
  }

  async function handleRun() {
    if (!canRun) return;
    setIsRunning(true);

    try {
      if (fixMode === "single" && selectedId) {
        const run = await fixIssue.mutateAsync(buildParams(selectedId));
        void navigate(`/workflows/runs/${run.id}`);
        return;
      }

      const targets =
        fixMode === "all"
          ? (issues ?? [])
          : (issues ?? []).filter((i) => selectedIds.has(i.id));

      if (targets.length === 0) return;

      if (targets.length === 1) {
        const run = await fixIssue.mutateAsync(buildParams(targets[0]!.id));
        void navigate(`/workflows/runs/${run.id}`);
        return;
      }

      const newFixing = new Map<string, string>();
      await Promise.all(
        targets.map(async (issue) => {
          try {
            const run = await fixIssue.mutateAsync(buildParams(issue.id));
            newFixing.set(issue.id, run.id);
          } catch {
            // skip failed
          }
        }),
      );
      setFixingIds(newFixing);
    } finally {
      setIsRunning(false);
    }
  }

  // ── Cascade helpers ──
  const showIssues = configComplete && fixMode !== "all";

  // How far through the cascade are we?
  const step =
    !effectiveKey ? 0
    : !effectiveOrg ? 1
    : !projectSlug ? 2
    : !repoUrl ? 3
    : 4; // ready

  return (
    <div className="rounded-xl border border-edge bg-surface/50 p-6 space-y-5">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg-2">
        <span className="material-symbols-outlined text-accent text-base">bug_report</span>
        Sentry Fixer
      </h3>

      {/* ── Sentry Key ── */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-fg-3">Sentry Key</label>
        {sentryKeys.length > 0 ? (
          sentryKeys.length === 1 ? (
            <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5 text-sm font-mono text-accent">
              <span className="material-symbols-outlined text-base">vpn_key</span>
              {sentryKeys[0]!.name}
            </div>
          ) : (
            <Select
              value={effectiveKey}
              onChange={(v) => {
                setSentryKey(v);
                setOrgSlug("");
                setProjectSlug("");
              }}
              placeholder="Select sentry key..."
              options={sentryKeys.map((k) => ({
                value: k.name,
                label: k.name,
              }))}
            />
          )
        ) : (
          <p className="py-2 text-xs text-fg-4">No Sentry keys configured. Add one in Settings.</p>
        )}
      </div>

      {/* ── Organization (dropdown from API) ── */}
      {step >= 1 && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-fg-3">Organization</label>
          {orgsLoading ? (
            <div className="flex items-center gap-2 py-2.5 text-xs text-fg-4">
              <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              Loading organizations...
            </div>
          ) : orgs && orgs.length === 1 ? (
            <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5 text-sm font-mono text-accent">
              <span className="material-symbols-outlined text-base">corporate_fare</span>
              {orgs[0]!.name}
              <span className="text-accent/50 text-xs">({orgs[0]!.slug})</span>
            </div>
          ) : orgs && orgs.length > 1 ? (
            <Select
              value={effectiveOrg}
              onChange={(v) => {
                setOrgSlug(v);
                setProjectSlug("");
              }}
              placeholder="Select organization..."
              options={orgs.map((o) => ({
                value: o.slug,
                label: `${o.name} (${o.slug})`,
              }))}
            />
          ) : (
            <p className="py-2 text-xs text-fg-4">No organizations found for this key.</p>
          )}
        </div>
      )}

      {/* ── Project (dropdown from API) ── */}
      {step >= 2 && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-fg-3">Project</label>
          {projectsLoading ? (
            <div className="flex items-center gap-2 py-2.5 text-xs text-fg-4">
              <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              Loading projects...
            </div>
          ) : sentryProjects && sentryProjects.length > 0 ? (
            <Select
              value={projectSlug}
              onChange={setProjectSlug}
              placeholder="Select project..."
              options={sentryProjects.map((p) => ({
                value: p.slug,
                label: `${p.name}${p.platform ? ` (${p.platform})` : ""}`,
              }))}
            />
          ) : (
            <p className="py-2 text-xs text-fg-4">No projects found in this organization.</p>
          )}
        </div>
      )}

      {/* ── Git Provider + Repo ── */}
      {step >= 3 && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-fg-3">Git Provider</label>
            {gitKeys.length > 0 ? (
              gitKeys.length === 1 ? (
                <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5 text-sm font-mono text-accent">
                  <span className="material-symbols-outlined text-base">code</span>
                  {gitKeys[0]!.name}
                </div>
              ) : (
                <Select
                  value={effectiveGitKey}
                  onChange={(v) => {
                    setGitKey(v);
                    setRepoUrl("");
                  }}
                  placeholder="Select git key..."
                  options={gitKeys.map((k) => ({
                    value: k.name,
                    label: `${k.name} (${k.provider})`,
                  }))}
                />
              )
            ) : (
              <p className="py-2 text-xs text-fg-4">No GitHub/GitLab keys</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-fg-3">Repository</label>
            {reposLoading && effectiveGitKey ? (
              <div className="flex items-center gap-2 py-2.5 text-xs text-fg-4">
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                Loading...
              </div>
            ) : repos && repos.length > 0 ? (
              <Select
                value={repoUrl}
                onChange={setRepoUrl}
                placeholder="Select repository..."
                options={repos.map((r) => ({
                  value: r.clone_url,
                  label: r.full_name,
                }))}
              />
            ) : (
              <p className="py-2 text-xs text-fg-4">No repositories found.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Fix Mode ── */}
      {step >= 4 && (
        <>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-fg-3">Fix Mode</label>
            <div className="flex gap-1 rounded-lg border border-edge bg-surface p-1">
              {([
                { key: "single" as const, label: "Single Issue", icon: "target" },
                { key: "batch" as const, label: "Batch Fix", icon: "checklist" },
                { key: "all" as const, label: "All Unresolved", icon: "select_all" },
              ]).map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => {
                    setFixMode(mode.key);
                    setSelectedId(null);
                    setSelectedIds(new Set());
                  }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                    fixMode === mode.key
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "text-fg-3 border border-transparent hover:text-fg-2"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{mode.icon}</span>
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Issues Picker ── */}
          {showIssues && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-4">search</span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search issues..."
                    className="w-full rounded-lg border border-edge bg-surface py-2 pl-9 pr-3 text-xs text-fg font-mono placeholder-fg-4 focus:border-accent focus:outline-none"
                  />
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as IssueSort)}
                  className="rounded-lg border border-edge bg-surface px-3 py-2 text-xs text-fg font-mono focus:border-accent focus:outline-none"
                >
                  <option value="freq">Frequency</option>
                  <option value="date">Last Seen</option>
                  <option value="new">First Seen</option>
                  <option value="priority">Priority</option>
                </select>
              </div>

              {issuesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-alt" />
                  ))}
                </div>
              ) : issues && issues.length > 0 ? (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-edge">
                  {issues.map((issue) => (
                    <IssuePickerRow
                      key={issue.id}
                      issue={issue}
                      mode={fixMode}
                      isSelected={
                        fixMode === "single"
                          ? selectedId === issue.id
                          : selectedIds.has(issue.id)
                      }
                      onSelect={() => {
                        if (fixMode === "single") {
                          setSelectedId(selectedId === issue.id ? null : issue.id);
                        } else {
                          toggleBatch(issue.id);
                        }
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-fg-4">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  No unresolved issues
                </div>
              )}

              {fixMode === "batch" && selectedIds.size > 0 && (
                <div className="flex items-center gap-2 text-xs text-accent">
                  <span className="material-symbols-outlined text-sm">checklist</span>
                  {selectedIds.size} issue{selectedIds.size !== 1 && "s"} selected
                </div>
              )}
            </div>
          )}

          {/* All Unresolved info */}
          {fixMode === "all" && (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-400/5 px-4 py-3 text-xs text-yellow-400">
              <span className="material-symbols-outlined text-base">info</span>
              Will create a fix run for every unresolved issue in {projectSlug}.
              {issues && <span className="font-mono ml-1">({issues.length} loaded)</span>}
            </div>
          )}

          {/* ── Run Button ── */}
          <button
            onClick={() => void handleRun()}
            disabled={!canRun || isRunning}
            className="flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-page shadow-[0_0_15px_rgba(0,255,64,0.3)] transition-all hover:bg-accent-hover disabled:opacity-50"
          >
            {isRunning ? (
              <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-lg">play_arrow</span>
            )}
            {fixMode === "single"
              ? "Fix Issue"
              : fixMode === "batch"
                ? `Fix ${selectedIds.size} Issue${selectedIds.size !== 1 ? "s" : ""}`
                : `Fix All (${issues?.length ?? 0})`}
          </button>

          {/* ── Batch Progress ── */}
          {fixingIds.size > 0 && (
            <BatchProgress fixingIds={fixingIds} issues={issues ?? []} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Issue Picker Row ───────────────────────────────────

function IssuePickerRow({
  issue,
  mode,
  isSelected,
  onSelect,
}: {
  issue: SentryIssue;
  mode: FixMode;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 border-b border-edge px-3 py-2.5 text-left transition-colors last:border-b-0 ${
        isSelected ? "bg-accent/10" : "hover:bg-surface-alt/50"
      }`}
    >
      {mode === "batch" ? (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 shrink-0 rounded border-edge accent-[#00ff40]"
        />
      ) : (
        <div
          className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors ${
            isSelected ? "border-accent bg-accent" : "border-edge"
          }`}
        />
      )}

      <div className={`h-2 w-2 shrink-0 rounded-full ${LEVEL_COLORS[issue.level] ?? "bg-gray-500"}`} />

      <span className="shrink-0 font-mono text-[10px] text-fg-4">{issue.shortId}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-fg">{issue.title}</span>
      <span className="shrink-0 rounded border border-edge bg-surface px-1.5 py-0.5 font-mono text-[10px] text-fg-4">
        {issue.count}x
      </span>
    </button>
  );
}

// ─── Batch Progress ─────────────────────────────────────

function BatchProgress({
  fixingIds,
  issues,
}: {
  fixingIds: Map<string, string>;
  issues: SentryIssue[];
}) {
  const entries = Array.from(fixingIds.entries());

  return (
    <div className="rounded-lg border border-edge bg-surface-alt/50 p-4">
      <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fg-2">
        <span className="material-symbols-outlined text-accent text-sm">build</span>
        Fixing {entries.length} issue{entries.length !== 1 && "s"}
      </h4>
      <div className="space-y-1.5">
        {entries.map(([issueId, runId]) => {
          const issue = issues.find((i) => i.id === issueId);
          return (
            <BatchProgressRow
              key={issueId}
              shortId={issue?.shortId ?? issueId.slice(0, 8)}
              title={issue?.title ?? "Unknown"}
              runId={runId}
            />
          );
        })}
      </div>
    </div>
  );
}

function BatchProgressRow({
  shortId,
  title,
  runId,
}: {
  shortId: string;
  title: string;
  runId: string;
}) {
  const stream = useWorkflowRunStream(runId);

  const currentStep = useMemo(() => {
    for (let i = stream.events.length - 1; i >= 0; i--) {
      const ev = stream.events[i]!;
      if (ev.event === "step_update") {
        const data = ev.data as { step_name?: string };
        return data.step_name;
      }
    }
    return null;
  }, [stream.events]);

  const statusIcon =
    stream.runStatus === "completed"
      ? "check_circle"
      : stream.runStatus === "failed"
        ? "error"
        : "progress_activity";

  const statusColor =
    stream.runStatus === "completed"
      ? "text-accent"
      : stream.runStatus === "failed"
        ? "text-red-400"
        : "text-yellow-400";

  return (
    <a
      href={`/workflows/runs/${runId}`}
      className="flex items-center gap-3 rounded-lg border border-edge bg-surface px-3 py-2 transition-colors hover:border-accent/30"
    >
      <span
        className={`material-symbols-outlined text-base ${statusColor} ${
          stream.runStatus !== "completed" && stream.runStatus !== "failed" ? "animate-spin" : ""
        }`}
      >
        {statusIcon}
      </span>
      <span className="shrink-0 font-mono text-[10px] text-fg-4">{shortId}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-fg-2">{title}</span>
      <span className="shrink-0 font-mono text-[10px] text-fg-4">
        {stream.runStatus === "completed"
          ? "done"
          : stream.runStatus === "failed"
            ? "failed"
            : currentStep ?? "starting"}
      </span>
    </a>
  );
}
