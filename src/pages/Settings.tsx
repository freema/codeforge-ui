import { useState, useMemo, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  useKeys,
  useCreateKey,
  useDeleteKey,
  useVerifyKey,
} from "../hooks/useKeys";
import type { KeyVerifyResult, MCPServer } from "../types";
import type { ToolDefinition } from "../types/session";
import {
  useMCPServers,
  useCreateMCPServer,
  useDeleteMCPServer,
} from "../hooks/useMCPServers";
import { useToolsCatalog } from "../hooks/useTools";
import { useWorkspaces, useDeleteWorkspace } from "../hooks/useWorkspaces";
type Tab = "keys" | "mcp" | "workspaces";

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "keys", label: "Provider Keys", icon: "vpn_key" },
  { id: "mcp", label: "MCP Servers", icon: "dns" },
  { id: "workspaces", label: "Workspaces", icon: "folder_open" },
];

const VALID_TABS = new Set<Tab>(["keys", "mcp", "workspaces"]);

export default function Settings() {
  usePageTitle("Settings");
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = rawTab && VALID_TABS.has(rawTab) ? rawTab : "keys";

  function setActiveTab(tab: Tab) {
    setSearchParams(tab === "keys" ? {} : { tab }, { replace: true });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-fg">Settings</h1>
        <p className="mt-1 text-sm text-fg-3">
          Manage your integrations and resources
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-edge pb-px">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === id
                ? "border-accent text-accent"
                : "border-transparent text-fg-3 hover:text-fg"
            }`}
          >
            <span className="material-symbols-outlined text-lg">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "keys" && <KeysTab />}
      {activeTab === "mcp" && <MCPTab />}
      {activeTab === "workspaces" && <WorkspacesTab />}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-sm text-fg font-mono placeholder-fg-4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors";

const KEY_PROVIDERS = [
  {
    value: "github",
    label: "GitHub",
    icon: "code",
    description: "GitHub personal access token",
  },
  {
    value: "gitlab",
    label: "GitLab",
    icon: "cloud",
    description: "GitLab personal access token",
  },
  {
    value: "sentry",
    label: "Sentry",
    icon: "bug_report",
    description: "Sentry authentication token",
  },
] as const;

function KeysTab() {
  const { data: keys, isLoading } = useKeys();
  const createKey = useCreateKey();
  const deleteKey = useDeleteKey();
  const verifyKey = useVerifyKey();

  const [formMode, setFormMode] = useState<"select" | "form">("select");
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("github");
  const [token, setToken] = useState("");
  const [scope, setScope] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [validationError, setValidationError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<
    Record<string, KeyVerifyResult>
  >({});
  const [verifying, setVerifying] = useState<string | null>(null);

  function selectProvider(value: string) {
    setProvider(value);
    setValidationError("");
    setFormMode("form");
  }

  function goBack() {
    setName("");
    setToken("");
    setScope("");
    setBaseUrl("");
    setValidationError("");
    setFormMode("select");
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setValidationError("");

    if (baseUrl.trim() && !/^https?:\/\/.+/.test(baseUrl.trim())) {
      setValidationError("Base URL must start with http:// or https://");
      return;
    }

    await createKey.mutateAsync({
      name,
      provider,
      token,
      scope: scope || undefined,
      base_url: baseUrl.trim() || undefined,
    });
    setName("");
    setToken("");
    setScope("");
    setBaseUrl("");
    setFormMode("select");
  }

  async function handleDelete(keyName: string) {
    await deleteKey.mutateAsync(keyName);
    setConfirmDelete(null);
    setVerifyResults((prev) => {
      const next = { ...prev };
      delete next[keyName];
      return next;
    });
  }

  async function handleVerify(keyName: string) {
    setVerifying(keyName);
    try {
      const result = await verifyKey.mutateAsync(keyName);
      setVerifyResults((prev) => ({ ...prev, [keyName]: result }));
    } catch {
      setVerifyResults((prev) => ({
        ...prev,
        [keyName]: {
          name: keyName,
          provider: "",
          valid: false,
          error: "Connection failed",
        },
      }));
    } finally {
      setVerifying(null);
    }
  }

  return (
    <div className="space-y-6">
      {isLoading ? (
        <LoadingSkeleton />
      ) : keys && keys.length > 0 ? (
        <div className="flex flex-col gap-3">
          {keys.map((k) => {
            const vr = verifyResults[k.name];
            const isVerifying = verifying === k.name;

            return (
              <div
                key={k.name}
                className={`rounded-xl border p-4 transition-colors ${
                  vr
                    ? vr.valid
                      ? "border-accent/30 bg-accent/5"
                      : "border-red-500/30 bg-red-500/5"
                    : "border-edge bg-surface-alt"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        vr
                          ? vr.valid
                            ? "bg-accent/10 border border-accent/30"
                            : "bg-red-500/10 border border-red-500/30"
                          : "bg-surface border border-edge"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined ${
                          vr
                            ? vr.valid
                              ? "text-accent"
                              : "text-red-400"
                            : "text-fg-3"
                        }`}
                      >
                        {vr ? (vr.valid ? "verified" : "gpp_bad") : "vpn_key"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-fg">{k.name}</span>
                        <span className="rounded-full border border-edge bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fg-3">
                          {k.provider}
                        </span>
                        {k.base_url && (
                          <span className="font-mono text-[10px] text-fg-4">
                            {k.base_url}
                          </span>
                        )}
                        {k.scope && (
                          <span className="text-xs text-fg-4">{k.scope}</span>
                        )}
                      </div>
                      {vr && vr.valid && vr.username && (
                        <div className="mt-1 flex items-center gap-2 text-xs text-fg-3">
                          <span className="material-symbols-outlined text-sm text-accent">
                            check_circle
                          </span>
                          <span className="font-medium text-fg-2">
                            {vr.username}
                          </span>
                          {vr.email && (
                            <>
                              <span className="text-fg-4">·</span>
                              <span>{vr.email}</span>
                            </>
                          )}
                        </div>
                      )}
                      {vr && vr.valid && vr.scopes && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {vr.scopes.split(",").map((s) => (
                            <span
                              key={s.trim()}
                              className="rounded border border-accent/20 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent"
                            >
                              {s.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                      {vr && !vr.valid && (
                        <p className="mt-1 text-xs text-red-400">
                          {vr.error || "Token is invalid or expired"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => void handleVerify(k.name)}
                      disabled={isVerifying}
                      className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-xs font-medium text-fg-3 transition-colors hover:border-accent/30 hover:text-accent disabled:opacity-50"
                    >
                      {isVerifying ? (
                        <span className="material-symbols-outlined animate-spin text-sm">
                          progress_activity
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-sm">
                          verified
                        </span>
                      )}
                      {isVerifying ? "Checking" : vr ? "Re-check" : "Verify"}
                    </button>

                    {confirmDelete === k.name ? (
                      <span className="flex items-center gap-2">
                        <button
                          onClick={() => void handleDelete(k.name)}
                          disabled={deleteKey.isPending}
                          className="rounded-lg border border-red-900/50 bg-red-900/20 px-3 py-2 text-xs font-medium text-red-400"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-fg-3"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(k.name)}
                        className="rounded-md border border-edge p-1.5 text-fg-4 transition-colors hover:border-red-900/50 hover:text-red-400"
                      >
                        <span className="material-symbols-outlined text-base">
                          delete
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-fg-4">
          No keys configured.
        </p>
      )}

      {/* ── Provider Picker ── */}
      {formMode === "select" && (
        <div className="rounded-xl border border-edge bg-surface/50 p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg-2">
            <span className="material-symbols-outlined text-accent text-base">
              add_circle
            </span>
            Add Provider Key
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {KEY_PROVIDERS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => selectProvider(p.value)}
                className="group flex flex-col items-start gap-2 rounded-lg border border-edge bg-surface-alt p-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"
              >
                <span className="material-symbols-outlined text-xl text-fg-3 group-hover:text-accent">
                  {p.icon}
                </span>
                <div>
                  <p className="text-sm font-medium text-fg">{p.label}</p>
                  <p className="mt-0.5 text-xs text-fg-4">{p.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Key Form ── */}
      {formMode === "form" && (
        <form
          onSubmit={(e) => void handleAdd(e)}
          className="rounded-xl border border-edge bg-surface/50 p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg-2">
              <span className="material-symbols-outlined text-accent text-base">
                {KEY_PROVIDERS.find((p) => p.value === provider)?.icon ??
                  "vpn_key"}
              </span>
              {KEY_PROVIDERS.find((p) => p.value === provider)?.label}
            </h3>
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-xs text-fg-3 transition-colors hover:text-accent"
            >
              <span className="material-symbols-outlined text-sm">
                arrow_back
              </span>
              Back
            </button>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              required
              className={inputCls}
            />
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Token"
              required
              className={inputCls}
            />
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={`Base URL for self-hosted (e.g. https://${provider === "sentry" ? "sentry" : provider === "gitlab" ? "gitlab" : "github"}.example.com)`}
              className={inputCls}
            />
            <input
              type="text"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Scope (optional)"
              className={inputCls}
            />
          </div>

          {validationError && (
            <p className="mt-3 text-xs text-red-400">{validationError}</p>
          )}

          <button
            type="submit"
            disabled={createKey.isPending}
            className="mt-4 flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-bold text-page transition-all hover:bg-accent-hover disabled:opacity-50"
          >
            {createKey.isPending ? (
              <span className="material-symbols-outlined animate-spin text-base">
                progress_activity
              </span>
            ) : (
              <span className="material-symbols-outlined text-lg">add</span>
            )}
            Add Key
          </button>
        </form>
      )}
    </div>
  );
}

const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function MCPServerCard({
  server,
  onDelete,
  isDeleting,
}: {
  server: MCPServer;
  onDelete: (name: string) => void;
  isDeleting: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const transport = server.transport ?? "stdio";
  const envCount = server.env ? Object.keys(server.env).length : 0;
  const headerCount = server.headers ? Object.keys(server.headers).length : 0;

  function handleDelete() {
    onDelete(server.name);
    setConfirmDelete(false);
  }

  return (
    <div className="rounded-xl border border-edge bg-surface-alt p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-edge bg-surface">
            <span className="material-symbols-outlined text-accent/60">
              {transport === "http" ? "cloud" : "dns"}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-fg">{server.name}</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  transport === "http"
                    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                    : "border-purple-500/30 bg-purple-500/10 text-purple-400"
                }`}
              >
                {transport}
              </span>
            </div>
            <p className="mt-0.5 truncate font-mono text-xs text-fg-4">
              {transport === "http"
                ? server.url
                : [server.command, server.package].filter(Boolean).join(" ")}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {envCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-fg-4">
                  <span className="material-symbols-outlined text-xs">key</span>
                  {envCount} env var{envCount !== 1 && "s"}
                  <span className="ml-1 font-mono text-fg-4/60">
                    ({Object.keys(server.env!).join(", ")} = {"•••••"})
                  </span>
                </span>
              )}
              {headerCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-fg-4">
                  <span className="material-symbols-outlined text-xs">
                    http
                  </span>
                  {headerCount} header{headerCount !== 1 && "s"}
                  <span className="ml-1 font-mono text-fg-4/60">
                    ({Object.keys(server.headers!).join(", ")} = {"•••••"})
                  </span>
                </span>
              )}
              {server.created_at && (
                <span className="text-[10px] text-fg-4">
                  {relativeTime(server.created_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg border border-red-900/50 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-400"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-fg-3"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-md border border-edge p-1.5 text-fg-4 transition-colors hover:border-red-900/50 hover:text-red-400"
            >
              <span className="material-symbols-outlined text-base">
                delete
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function KeyValueEditor({
  entries,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: {
  entries: [string, string][];
  onChange: (entries: [string, string][]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  function addRow() {
    onChange([...entries, ["", ""]]);
  }

  function updateRow(index: number, field: 0 | 1, value: string) {
    const next = entries.map((e, i) =>
      i === index
        ? ((field === 0 ? [value, e[1]] : [e[0], value]) as [string, string])
        : e,
    );
    onChange(next);
  }

  function removeRow(index: number) {
    onChange(entries.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, val], i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={key}
            onChange={(e) => updateRow(i, 0, e.target.value)}
            placeholder={keyPlaceholder}
            className={inputCls}
          />
          <input
            type="password"
            value={val}
            onChange={(e) => updateRow(i, 1, e.target.value)}
            placeholder={valuePlaceholder}
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="shrink-0 rounded-lg border border-edge p-2 text-fg-4 transition-colors hover:border-red-900/50 hover:text-red-400"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1 text-xs text-fg-3 transition-colors hover:text-accent"
      >
        <span className="material-symbols-outlined text-sm">add</span>
        Add
      </button>
    </div>
  );
}

const TOOL_ICONS: Record<string, string> = {
  sentry: "bug_report",
  jira: "task_alt",
  git: "commit",
  github: "code",
  playwright: "web",
};

function MCPTab() {
  const { data: servers, isLoading } = useMCPServers();
  const { data: catalog, isLoading: catalogLoading } = useToolsCatalog();
  const createServer = useCreateMCPServer();
  const deleteServer = useDeleteMCPServer();

  const [formMode, setFormMode] = useState<"select" | "preset" | "custom">(
    "select",
  );
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);
  const [presetEnv, setPresetEnv] = useState<Record<string, string>>({});
  const [presetUrl, setPresetUrl] = useState("");

  // Custom form state
  const [transport, setTransport] = useState<"stdio" | "http">("stdio");
  const [name, setName] = useState("");
  const [pkg, setPkg] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [envEntries, setEnvEntries] = useState<[string, string][]>([]);
  const [headerEntries, setHeaderEntries] = useState<[string, string][]>([]);
  const [validationError, setValidationError] = useState("");

  const mcpTools = useMemo(
    () =>
      catalog?.filter((t: ToolDefinition) => t.type === "mcp" && t.builtin) ??
      [],
    [catalog],
  );

  const serverNames = useMemo(
    () => new Set(servers?.map((s) => s.name) ?? []),
    [servers],
  );

  function resetForm() {
    setName("");
    setPkg("");
    setCommand("");
    setArgs("");
    setUrl("");
    setEnvEntries([]);
    setHeaderEntries([]);
    setValidationError("");
    setPresetEnv({});
    setPresetUrl("");
    setSelectedTool(null);
  }

  function goBack() {
    resetForm();
    setFormMode("select");
  }

  function selectPreset(tool: ToolDefinition) {
    setSelectedTool(tool);
    setPresetEnv({});
    setPresetUrl(tool.mcp_url ?? "");
    setValidationError("");
    setFormMode("preset");
  }

  async function handlePresetSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedTool) return;
    setValidationError("");

    if (serverNames.has(selectedTool.name)) {
      setValidationError(`Server "${selectedTool.name}" already exists`);
      return;
    }

    const isHttp = selectedTool.mcp_transport === "http";

    if (isHttp && !presetUrl.trim()) {
      setValidationError("URL is required");
      return;
    }

    // For HTTP: config fields become headers; for stdio: they become env vars
    const configEntries = selectedTool.required_config?.length
      ? Object.fromEntries(
          selectedTool.required_config
            .filter((f) => f.env_var && presetEnv[f.name]?.trim())
            .map((f) => [f.env_var!, presetEnv[f.name] as string]),
        )
      : undefined;
    const hasConfig = configEntries && Object.keys(configEntries).length > 0;

    await createServer.mutateAsync({
      name: selectedTool.name,
      transport: isHttp ? "http" : "stdio",
      ...(isHttp
        ? {
            url: presetUrl.trim(),
            headers: hasConfig ? configEntries : undefined,
          }
        : {
            package: selectedTool.mcp_package || undefined,
            command: selectedTool.mcp_command || undefined,
            env: hasConfig ? configEntries : undefined,
          }),
    });
    resetForm();
    setFormMode("select");
  }

  async function handleCustomSubmit(e: FormEvent) {
    e.preventDefault();
    setValidationError("");

    if (!NAME_PATTERN.test(name)) {
      setValidationError(
        "Name must contain only letters, numbers, hyphens, and underscores",
      );
      return;
    }

    if (transport === "stdio" && !pkg.trim()) {
      setValidationError("Package is required for stdio transport");
      return;
    }

    if (transport === "http" && !url.trim()) {
      setValidationError("URL is required for http transport");
      return;
    }

    const env =
      envEntries.length > 0
        ? Object.fromEntries(envEntries.filter(([k]) => k.trim()))
        : undefined;
    const headers =
      headerEntries.length > 0
        ? Object.fromEntries(headerEntries.filter(([k]) => k.trim()))
        : undefined;

    let parsedArgs: string[] | undefined;
    if (args.trim()) {
      try {
        const parsed = JSON.parse(args.trim());
        if (Array.isArray(parsed)) {
          parsedArgs = parsed as string[];
        } else {
          parsedArgs = args
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean);
        }
      } catch {
        parsedArgs = args
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);
      }
    }

    await createServer.mutateAsync({
      name,
      transport,
      ...(transport === "stdio"
        ? {
            package: pkg,
            command: command.trim() || undefined,
            args: parsedArgs,
            env,
          }
        : {
            url,
            headers,
          }),
    });
    resetForm();
    setFormMode("select");
  }

  async function handleDelete(serverName: string) {
    await deleteServer.mutateAsync(serverName);
  }

  return (
    <div className="space-y-6">
      {isLoading ? (
        <LoadingSkeleton />
      ) : servers && servers.length > 0 ? (
        <div className="flex flex-col gap-3">
          {servers.map((s) => (
            <MCPServerCard
              key={s.name}
              server={s}
              onDelete={handleDelete}
              isDeleting={deleteServer.isPending}
            />
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-fg-4">
          No MCP servers configured.
        </p>
      )}

      {/* ── Service Picker ── */}
      {formMode === "select" && (
        <div className="rounded-xl border border-edge bg-surface/50 p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg-2">
            <span className="material-symbols-outlined text-accent text-base">
              add_circle
            </span>
            Add MCP Server
          </h3>

          {catalogLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-lg bg-surface-alt"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {mcpTools.map((tool) => {
                const alreadyAdded = serverNames.has(tool.name);
                return (
                  <button
                    key={tool.name}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => selectPreset(tool)}
                    className={`group relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                      alreadyAdded
                        ? "cursor-default border-accent/20 bg-accent/5 opacity-60"
                        : "border-edge bg-surface-alt hover:border-accent/40 hover:bg-accent/5"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span
                        className={`material-symbols-outlined text-xl ${alreadyAdded ? "text-accent" : "text-fg-3 group-hover:text-accent"}`}
                      >
                        {TOOL_ICONS[tool.name] ?? "extension"}
                      </span>
                      {alreadyAdded && (
                        <span className="material-symbols-outlined text-sm text-accent">
                          check_circle
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-fg capitalize">
                        {tool.name}
                      </p>
                      <p className="mt-0.5 text-xs text-fg-4 line-clamp-2">
                        {tool.description}
                      </p>
                    </div>
                    {(tool.required_config?.length ?? 0) > 0 && (
                      <span className="text-[10px] text-fg-4">
                        {tool.required_config!.length} config field
                        {tool.required_config!.length !== 1 && "s"}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Custom card */}
              <button
                type="button"
                onClick={() => setFormMode("custom")}
                className="group flex flex-col items-start gap-2 rounded-lg border border-dashed border-edge p-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"
              >
                <span className="material-symbols-outlined text-xl text-fg-3 group-hover:text-accent">
                  dns
                </span>
                <div>
                  <p className="text-sm font-medium text-fg">Custom</p>
                  <p className="mt-0.5 text-xs text-fg-4">
                    Manual server configuration
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Preset Form ── */}
      {formMode === "preset" && selectedTool && (
        <form
          onSubmit={(e) => void handlePresetSubmit(e)}
          className="rounded-xl border border-edge bg-surface/50 p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg-2">
              <span className="material-symbols-outlined text-accent text-base">
                {TOOL_ICONS[selectedTool.name] ?? "extension"}
              </span>
              {selectedTool.name}
            </h3>
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-xs text-fg-3 transition-colors hover:text-accent"
            >
              <span className="material-symbols-outlined text-sm">
                arrow_back
              </span>
              Back
            </button>
          </div>

          {/* Connection info */}
          {selectedTool.mcp_transport === "http" ? (
            <div className="mb-4">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-fg-3">
                <span className="material-symbols-outlined text-sm text-cyan-400">
                  cloud
                </span>
                Server URL
                <span
                  className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border-cyan-500/30 bg-cyan-500/10 text-cyan-400`}
                >
                  http
                </span>
              </label>
              <input
                type="url"
                value={presetUrl}
                onChange={(e) => setPresetUrl(e.target.value)}
                placeholder="https://mcp.sentry.dev/mcp"
                required
                className={inputCls}
              />
            </div>
          ) : selectedTool.mcp_package ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-edge bg-surface px-3 py-2">
              <span className="material-symbols-outlined text-sm text-purple-400">
                terminal
              </span>
              <p className="font-mono text-xs text-fg-3">
                {selectedTool.mcp_command ?? "npx"} {selectedTool.mcp_package}
              </p>
              <span className="ml-auto rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border-purple-500/30 bg-purple-500/10 text-purple-400">
                stdio
              </span>
            </div>
          ) : null}

          {selectedTool.required_config &&
          selectedTool.required_config.length > 0 ? (
            <div className="space-y-3">
              {selectedTool.required_config.map((field) => (
                <div key={field.name}>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-fg-3">
                    {field.sensitive && (
                      <span className="material-symbols-outlined text-sm">
                        key
                      </span>
                    )}
                    {field.name}
                    <span className="text-fg-4 font-normal">
                      — {field.description}
                    </span>
                  </label>
                  <input
                    type={field.sensitive ? "password" : "text"}
                    value={presetEnv[field.name] ?? ""}
                    onChange={(e) =>
                      setPresetEnv((prev) => ({
                        ...prev,
                        [field.name]: e.target.value,
                      }))
                    }
                    placeholder={field.env_var ?? field.name}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-fg-4">
              No configuration needed
            </p>
          )}

          {validationError && (
            <p className="mt-3 text-xs text-red-400">{validationError}</p>
          )}

          <button
            type="submit"
            disabled={createServer.isPending}
            className="mt-4 flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-bold text-page transition-all hover:bg-accent-hover disabled:opacity-50"
          >
            {createServer.isPending ? (
              <span className="material-symbols-outlined animate-spin text-base">
                progress_activity
              </span>
            ) : (
              <span className="material-symbols-outlined text-lg">add</span>
            )}
            Add Server
          </button>
        </form>
      )}

      {/* ── Custom Form ── */}
      {formMode === "custom" && (
        <form
          onSubmit={(e) => void handleCustomSubmit(e)}
          className="rounded-xl border border-edge bg-surface/50 p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg-2">
              <span className="material-symbols-outlined text-accent text-base">
                add_circle
              </span>
              Add MCP Server
            </h3>
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-xs text-fg-3 transition-colors hover:text-accent"
            >
              <span className="material-symbols-outlined text-sm">
                arrow_back
              </span>
              Back
            </button>
          </div>

          {/* Transport toggle */}
          <div className="mb-4 flex gap-1 rounded-lg border border-edge bg-surface p-1 w-fit">
            {(["stdio", "http"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTransport(t);
                  setValidationError("");
                }}
                className={`rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                  transport === t
                    ? "bg-accent text-page"
                    : "text-fg-3 hover:text-fg"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              required
              className={inputCls}
            />

            {transport === "stdio" ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    value={pkg}
                    onChange={(e) => setPkg(e.target.value)}
                    placeholder="Package (required)"
                    required
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="Command (default: npx)"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={args}
                    onChange={(e) => setArgs(e.target.value)}
                    placeholder="Args (comma-separated or JSON)"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-fg-3">
                    <span className="material-symbols-outlined text-sm">
                      key
                    </span>
                    Environment Variables
                  </label>
                  <KeyValueEditor
                    entries={envEntries}
                    onChange={setEnvEntries}
                    keyPlaceholder="ENV_VAR"
                    valuePlaceholder="value"
                  />
                </div>
              </>
            ) : (
              <>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="URL (required)"
                  required
                  className={inputCls}
                />

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-fg-3">
                    <span className="material-symbols-outlined text-sm">
                      http
                    </span>
                    Headers
                  </label>
                  <KeyValueEditor
                    entries={headerEntries}
                    onChange={setHeaderEntries}
                    keyPlaceholder="Header-Name"
                    valuePlaceholder="value"
                  />
                </div>
              </>
            )}
          </div>

          {validationError && (
            <p className="mt-3 text-xs text-red-400">{validationError}</p>
          )}

          <button
            type="submit"
            disabled={createServer.isPending}
            className="mt-4 flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-bold text-page transition-all hover:bg-accent-hover disabled:opacity-50"
          >
            {createServer.isPending ? (
              <span className="material-symbols-outlined animate-spin text-base">
                progress_activity
              </span>
            ) : (
              <span className="material-symbols-outlined text-lg">add</span>
            )}
            Add Server
          </button>
        </form>
      )}
    </div>
  );
}

function WorkspacesTab() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const deleteWorkspace = useDeleteWorkspace();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function handleDelete(sessionId: string) {
    await deleteWorkspace.mutateAsync(sessionId);
    setConfirmDelete(null);
  }

  const totalMB =
    Math.round((workspaces?.reduce((sum, w) => sum + w.size_mb, 0) ?? 0) * 10) /
    10;

  return (
    <div className="space-y-6">
      {!isLoading && workspaces && workspaces.length > 0 && (
        <p className="text-sm text-fg-3">
          Total disk usage:{" "}
          <span className="font-mono font-bold text-accent">{totalMB} MB</span>
        </p>
      )}

      {isLoading ? (
        <LoadingSkeleton />
      ) : workspaces && workspaces.length > 0 ? (
        <div className="flex flex-col gap-3">
          {workspaces.map((w) => (
            <div
              key={w.session_id}
              className="flex items-center justify-between rounded-xl border border-edge bg-surface-alt p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-edge bg-surface">
                  <span className="material-symbols-outlined text-accent/60">
                    folder
                  </span>
                </div>
                <div>
                  <span className="font-mono text-sm text-fg">
                    {w.session_id.slice(0, 12)}...
                  </span>
                  <p className="text-xs text-fg-4">{w.path}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm text-fg-3">
                  {Math.round(w.size_mb * 10) / 10} MB
                </span>
                {confirmDelete === w.session_id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleDelete(w.session_id)}
                      disabled={deleteWorkspace.isPending}
                      className="rounded-lg border border-red-900/50 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-400"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="text-xs text-fg-3"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(w.session_id)}
                    className="rounded-md border border-edge p-1.5 text-fg-4 transition-colors hover:border-red-900/50 hover:text-red-400"
                  >
                    <span className="material-symbols-outlined text-base">
                      delete
                    </span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-fg-4">
          No workspaces found.
        </p>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-alt" />
      ))}
    </div>
  );
}
