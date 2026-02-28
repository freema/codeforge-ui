import { useState, useMemo, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useCreateTask } from "../hooks/useTaskMutations";
import { useKeys } from "../hooks/useKeys";
import { useMCPServers } from "../hooks/useMCPServers";
import { useRepositories } from "../hooks/useRepositories";
import { useCLIs } from "../hooks/useCLIs";
import { useTaskTypes } from "../hooks/useTaskTypes";
import { trackTaskId } from "../lib/taskStore";
import { usePageTitle } from "../hooks/usePageTitle";
import Select from "../components/Select";
import type { CreateTaskRequest, TaskConfig, Repository } from "../types";

const MODELS_BY_CLI: Record<string, { default: string; models: string[] }> = {
  "claude-code": {
    default: "claude-sonnet-4-6-20250627",
    models: [
      "claude-sonnet-4-6-20250627",
      "claude-opus-4-6-20250625",
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
    ],
  },
  codex: {
    default: "gpt-4.1",
    models: [
      "gpt-5.2",
      "gpt-5.1",
      "gpt-5",
      "gpt-4.1",
      "o3",
      "o4-mini",
    ],
  },
};

const TASK_TYPE_ICONS: Record<string, string> = {
  code: "code",
  plan: "map",
  review: "rate_review",
};

const TASK_TYPE_HINTS: Record<string, string> = {
  code: "Be specific about the changes you want. The agent will clone the repo and work autonomously.",
  plan: "Describe what you want planned. The agent will analyze the repo and produce a step-by-step plan.",
  review: "Describe the review focus, or leave empty for a general review.",
};

export default function NewTask() {
  usePageTitle("New Task");
  const navigate = useNavigate();
  const createTask = useCreateTask();
  const { data: keys } = useKeys();
  const { data: mcpServers } = useMCPServers();
  const { data: clis } = useCLIs();
  const { data: taskTypes } = useTaskTypes();

  // Task type
  const [taskType, setTaskType] = useState("code");

  // Core fields
  const [providerKey, setProviderKey] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [sourceBranch, setSourceBranch] = useState("");
  const [targetBranch, setTargetBranch] = useState("");
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // CLI & Model
  const [selectedCli, setSelectedCli] = useState("");
  const [aiModel, setAiModel] = useState("");

  // Advanced fields
  const [timeout, setTimeout] = useState("");
  const [maxTurns, setMaxTurns] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [selectedMcp, setSelectedMcp] = useState<string[]>([]);

  // Fetch repositories when provider key is selected
  const { data: repos, isLoading: reposLoading } = useRepositories(
    providerKey || undefined,
  );

  // Available CLIs only
  const availableClis = useMemo(
    () => clis?.filter((c) => c.available) ?? [],
    [clis],
  );

  // Auto-select first key on load
  useEffect(() => {
    if (keys && keys.length > 0 && !providerKey) {
      setProviderKey(keys[0]!.name);
    }
  }, [keys, providerKey]);

  // Auto-select default CLI
  useEffect(() => {
    if (availableClis.length > 0 && !selectedCli) {
      const defaultCli = availableClis.find((c) => c.is_default);
      setSelectedCli(defaultCli?.name ?? availableClis[0]!.name);
    }
  }, [availableClis, selectedCli]);

  // Models available for the selected CLI
  const cliConfig = useMemo(
    () => MODELS_BY_CLI[selectedCli],
    [selectedCli],
  );
  const defaultModelLabel = cliConfig
    ? `Default (${cliConfig.default})`
    : "Default";

  const selectedTaskType = taskTypes?.find((t) => t.name === taskType);
  const taskTypeHint = TASK_TYPE_HINTS[taskType] ?? selectedTaskType?.description ?? "";
  const taskTypePlaceholder = selectedTaskType?.description ?? "Describe what the AI agent should do with this repository...";

  function handleRepoSelect(repo: Repository) {
    setSelectedRepo(repo);
    setRepoUrl(repo.clone_url);
    setSourceBranch(repo.default_branch);
    setTargetBranch(repo.default_branch);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const config: TaskConfig = {};
    if (selectedCli) config.cli = selectedCli;
    if (aiModel) config.ai_model = aiModel;
    if (timeout) config.timeout_seconds = Number(timeout);
    if (maxTurns) config.max_turns = Number(maxTurns);
    if (sourceBranch) config.source_branch = sourceBranch;
    if (targetBranch) config.target_branch = targetBranch;
    if (maxBudget) config.max_budget_usd = Number(maxBudget);
    if (selectedMcp.length > 0) {
      config.mcp_servers = selectedMcp.map((name) => ({ name }));
    }

    const req: CreateTaskRequest = {
      repo_url: repoUrl,
      prompt,
      task_type: taskType,
      ...(providerKey ? { provider_key: providerKey } : {}),
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      ...(Object.keys(config).length > 0 ? { config } : {}),
    };

    try {
      const task = await createTask.mutateAsync(req);
      trackTaskId(task.id);
      void navigate(`/tasks/${task.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    }
  }

  function toggleMcp(name: string) {
    setSelectedMcp((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  const inputCls =
    "w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-sm text-fg font-mono placeholder-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-fg">New Task</h1>
        <p className="mt-2 text-sm text-fg-3">
          Configure and launch an AI coding task
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Provider */}
        {keys && keys.length > 0 && (
          <div>
            <label className="mb-2 block text-xs font-medium text-fg-3">
              Provider
            </label>
            <div className="flex gap-2">
              {keys.map((k) => (
                <button
                  key={k.name}
                  type="button"
                  onClick={() => {
                    setProviderKey(k.name);
                    setSelectedRepo(null);
                    setRepoUrl("");
                  }}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                    providerKey === k.name
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-edge bg-surface text-fg-3 hover:border-fg-4 hover:text-fg"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">
                    {k.provider === "github" ? "code" : "cloud"}
                  </span>
                  {k.name}
                  <span className="text-xs text-fg-4">({k.provider})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Repository */}
        <div>
          <label className="mb-2 block text-xs font-medium text-fg-3">
            Repository
          </label>
          {providerKey && repos && repos.length > 0 ? (
            <div className="space-y-3">
              <RepoSelector
                repos={repos}
                selected={selectedRepo}
                loading={reposLoading}
                onSelect={handleRepoSelect}
              />
              {selectedRepo && (
                <div className="flex items-center gap-3 rounded-lg border border-accent/20 bg-accent/5 p-3">
                  <span className="material-symbols-outlined text-accent">check_circle</span>
                  <div>
                    <p className="text-sm font-medium text-fg">
                      {selectedRepo.full_name}
                    </p>
                    <p className="text-xs text-fg-3">
                      {selectedRepo.description || "No description"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : providerKey && reposLoading ? (
            <div className="flex items-center gap-3 rounded-lg border border-edge bg-surface p-4">
              <span className="material-symbols-outlined animate-spin text-accent">progress_activity</span>
              <span className="text-sm text-fg-3">Loading repositories...</span>
            </div>
          ) : (
            <div>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/user/repo.git"
                required
                className={inputCls}
              />
              {!providerKey && keys && keys.length > 0 && (
                <p className="mt-2 text-xs text-fg-4">
                  Select a provider key above to browse repositories
                </p>
              )}
            </div>
          )}
        </div>

        {/* Branches */}
        {(selectedRepo || repoUrl) && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-fg-3">
                Source Branch
              </label>
              <input
                type="text"
                value={sourceBranch}
                onChange={(e) => setSourceBranch(e.target.value)}
                placeholder={selectedRepo?.default_branch || "main"}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-fg-3">
                Target Branch (for PR)
              </label>
              <input
                type="text"
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                placeholder={selectedRepo?.default_branch || "main"}
                className={inputCls}
              />
            </div>
          </div>
        )}

        {/* Task Type */}
        {taskTypes && taskTypes.length > 0 && (
          <div>
            <label className="mb-2 block text-xs font-medium text-fg-3">
              Task Type
            </label>
            <div className="flex gap-2">
              {taskTypes.map((tt) => (
                <button
                  key={tt.name}
                  type="button"
                  onClick={() => setTaskType(tt.name)}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                    taskType === tt.name
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-edge bg-surface text-fg-3 hover:border-fg-4 hover:text-fg"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">
                    {TASK_TYPE_ICONS[tt.name] ?? "task"}
                  </span>
                  {tt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Task description */}
        <div>
          <label className="mb-2 block text-xs font-medium text-fg-3">
            What should the agent do?
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={taskTypePlaceholder}
            required={taskType !== "review"}
            minLength={taskType === "review" ? 0 : 10}
            rows={5}
            className={inputCls + " resize-none"}
          />
          <p className="mt-2 text-xs text-fg-4">
            {taskTypeHint}
          </p>
        </div>

        {/* CLI & Model row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-fg-3">
              CLI
            </label>
            <Select
              value={selectedCli}
              onChange={(v) => {
                setSelectedCli(v);
                setAiModel("");
              }}
              options={availableClis.map((cli) => ({
                value: cli.name,
                label: cli.name + (cli.is_default ? " (default)" : ""),
              }))}
              placeholder="Select CLI..."
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-fg-3">
              AI Model
            </label>
            <Select
              value={aiModel}
              onChange={setAiModel}
              options={[
                { value: "", label: defaultModelLabel },
                ...(cliConfig?.models.map((m) => ({ value: m, label: m })) ?? []),
              ]}
            />
          </div>
        </div>

        {/* Advanced */}
        <div className="rounded-xl border border-edge bg-surface">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between p-4 text-sm font-medium text-fg-3 hover:text-fg transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">tune</span>
              Advanced Configuration
            </div>
            <span className="material-symbols-outlined text-base transition-transform" style={{ transform: showAdvanced ? "rotate(180deg)" : "none" }}>
              expand_more
            </span>
          </button>

          {showAdvanced && (
            <div className="border-t border-edge p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-fg-3">
                    Max Iterations
                  </label>
                  <input
                    type="number"
                    value={maxTurns}
                    onChange={(e) => setMaxTurns(e.target.value)}
                    placeholder="default: unlimited"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-fg-3">
                    Timeout (seconds)
                  </label>
                  <input
                    type="number"
                    value={timeout}
                    onChange={(e) => setTimeout(e.target.value)}
                    placeholder="600"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-fg-3">
                    Max Budget ($)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value)}
                    placeholder="5.00"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-fg-3">
                  Callback URL
                </label>
                <input
                  type="url"
                  value={callbackUrl}
                  onChange={(e) => setCallbackUrl(e.target.value)}
                  placeholder="https://your-app.com/webhook"
                  className={inputCls}
                />
              </div>

              {/* MCP Servers */}
              {mcpServers && mcpServers.length > 0 && (
                <div>
                  <label className="mb-2 block text-xs text-fg-3">
                    MCP Servers
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {mcpServers.map((s) => (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => toggleMcp(s.name)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                          selectedMcp.includes(s.name)
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-edge text-fg-3 hover:border-fg-4"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {selectedMcp.includes(s.name) ? "check_circle" : "radio_button_unchecked"}
                        </span>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-red-900/50 bg-red-900/10 p-4">
            <span className="material-symbols-outlined text-red-400">error</span>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => void navigate(-1)}
            className="rounded-lg border border-edge bg-surface px-6 py-3 text-sm font-medium text-fg-3 transition-colors hover:border-fg-4 hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createTask.isPending || !repoUrl || !prompt}
            className="flex items-center gap-2 rounded-lg bg-accent px-8 py-3 text-sm font-bold text-page shadow-[0_0_20px_rgba(0,255,64,0.3)] transition-all hover:bg-accent-hover hover:shadow-[0_0_30px_rgba(0,255,64,0.5)] disabled:opacity-40 disabled:shadow-none"
          >
            {createTask.isPending ? (
              <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-xl">bolt</span>
            )}
            Launch Task
          </button>
        </div>
      </form>
    </div>
  );
}

function RepoSelector({
  repos,
  selected,
  loading,
  onSelect,
}: {
  repos: Repository[];
  selected: Repository | null;
  loading: boolean;
  onSelect: (repo: Repository) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(!selected);

  const filtered = useMemo(() => {
    if (!search) return repos.slice(0, 20);
    const q = search.toLowerCase();
    return repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q),
    );
  }, [repos, search]);

  if (!open && selected) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-lg border border-edge bg-surface p-3 text-left transition-colors hover:border-fg-4"
      >
        <span className="text-sm text-fg font-mono">{selected.full_name}</span>
        <span className="material-symbols-outlined text-sm text-fg-3">unfold_more</span>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-fg-4 text-lg">
          search
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search repositories..."
          className="w-full rounded-lg border border-edge bg-surface py-2.5 pl-10 pr-3 text-sm text-fg font-mono placeholder-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          autoFocus
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <span className="material-symbols-outlined animate-spin text-accent">progress_activity</span>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-edge">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-fg-4">
              No repositories found
            </p>
          ) : (
            filtered.map((repo) => (
              <button
                key={repo.full_name}
                type="button"
                onClick={() => {
                  onSelect(repo);
                  setOpen(false);
                  setSearch("");
                }}
                className={`flex w-full items-center gap-3 border-b border-edge p-3 text-left transition-colors last:border-b-0 hover:bg-accent/5 ${
                  selected?.full_name === repo.full_name
                    ? "bg-accent/10"
                    : ""
                }`}
              >
                <span className="material-symbols-outlined text-fg-4 text-lg">
                  {repo.private ? "lock" : "public"}
                </span>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-fg">
                    {repo.full_name}
                  </p>
                  {repo.description && (
                    <p className="truncate text-xs text-fg-4">
                      {repo.description}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded border border-edge px-1.5 py-0.5 text-[10px] font-mono text-fg-3">
                  {repo.default_branch}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
