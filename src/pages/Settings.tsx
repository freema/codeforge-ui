import { useState, type FormEvent } from "react";
import { usePageTitle } from "../hooks/usePageTitle";
import { useKeys, useCreateKey, useDeleteKey, useVerifyKey } from "../hooks/useKeys";
import type { KeyVerifyResult } from "../types";
import Select from "../components/Select";
import {
  useMCPServers,
  useCreateMCPServer,
  useDeleteMCPServer,
} from "../hooks/useMCPServers";
import { useWorkspaces, useDeleteWorkspace } from "../hooks/useWorkspaces";

type Tab = "keys" | "mcp" | "workspaces";

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "keys", label: "Provider Keys", icon: "vpn_key" },
  { id: "mcp", label: "MCP Servers", icon: "dns" },
  { id: "workspaces", label: "Workspaces", icon: "folder_open" },
];

export default function Settings() {
  usePageTitle("Settings");
  const [activeTab, setActiveTab] = useState<Tab>("keys");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-fg">Settings</h1>
        <p className="mt-1 text-sm text-fg-3">Manage your integrations and resources</p>
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

function KeysTab() {
  const { data: keys, isLoading } = useKeys();
  const createKey = useCreateKey();
  const deleteKey = useDeleteKey();
  const verifyKey = useVerifyKey();

  const [name, setName] = useState("");
  const [provider, setProvider] = useState("github");
  const [token, setToken] = useState("");
  const [scope, setScope] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, KeyVerifyResult>>({});
  const [verifying, setVerifying] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    await createKey.mutateAsync({
      name,
      provider,
      token,
      scope: scope || undefined,
    });
    setName("");
    setToken("");
    setScope("");
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
        [keyName]: { name: keyName, provider: "", valid: false, error: "Connection failed" },
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
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      vr
                        ? vr.valid
                          ? "bg-accent/10 border border-accent/30"
                          : "bg-red-500/10 border border-red-500/30"
                        : "bg-surface border border-edge"
                    }`}>
                      <span className={`material-symbols-outlined ${
                        vr ? (vr.valid ? "text-accent" : "text-red-400") : "text-fg-3"
                      }`}>
                        {vr ? (vr.valid ? "verified" : "gpp_bad") : "vpn_key"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-fg">{k.name}</span>
                        <span className="rounded-full border border-edge bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fg-3">
                          {k.provider}
                        </span>
                        {k.scope && (
                          <span className="text-xs text-fg-4">{k.scope}</span>
                        )}
                      </div>
                      {vr && vr.valid && vr.username && (
                        <div className="mt-1 flex items-center gap-2 text-xs text-fg-3">
                          <span className="material-symbols-outlined text-sm text-accent">check_circle</span>
                          <span className="font-medium text-fg-2">{vr.username}</span>
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
                        <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-sm">verified</span>
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
                        className="rounded-lg border border-edge p-2 text-fg-3 transition-colors hover:border-red-900/50 hover:text-red-400"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
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

      {/* Add form */}
      <form
        onSubmit={(e) => void handleAdd(e)}
        className="rounded-xl border border-edge bg-surface/50 p-5"
      >
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg-2">
          <span className="material-symbols-outlined text-accent text-base">add_circle</span>
          Add Provider Key
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required className={inputCls} />
          <Select
            value={provider}
            onChange={setProvider}
            options={[
              { value: "github", label: "GitHub" },
              { value: "gitlab", label: "GitLab" },
            ]}
          />
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token" required className={inputCls} />
          <input type="text" value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Scope (optional)" className={inputCls} />
        </div>
        <button
          type="submit"
          disabled={createKey.isPending}
          className="mt-4 flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-bold text-page transition-all hover:bg-accent-hover disabled:opacity-50"
        >
          {createKey.isPending ? <span className="material-symbols-outlined animate-spin text-base">progress_activity</span> : <span className="material-symbols-outlined text-lg">add</span>}
          Add Key
        </button>
      </form>
    </div>
  );
}

function MCPTab() {
  const { data: servers, isLoading } = useMCPServers();
  const createServer = useCreateMCPServer();
  const deleteServer = useDeleteMCPServer();

  const [name, setName] = useState("");
  const [pkg, setPkg] = useState("");
  const [args, setArgs] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    await createServer.mutateAsync({
      name,
      package: pkg,
      args: args ? (JSON.parse(args) as string[]) : undefined,
    });
    setName("");
    setPkg("");
    setArgs("");
  }

  async function handleDelete(serverName: string) {
    await deleteServer.mutateAsync(serverName);
    setConfirmDelete(null);
  }

  return (
    <div className="space-y-6">
      {isLoading ? (
        <LoadingSkeleton />
      ) : servers && servers.length > 0 ? (
        <div className="flex flex-col gap-3">
          {servers.map((s) => (
            <div
              key={s.name}
              className="flex items-center justify-between rounded-xl border border-edge bg-surface-alt p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-edge bg-surface">
                  <span className="material-symbols-outlined text-accent/60">dns</span>
                </div>
                <div>
                  <span className="font-medium text-fg">{s.name}</span>
                  <p className="font-mono text-xs text-fg-4">{s.package}</p>
                </div>
              </div>
              {confirmDelete === s.name ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleDelete(s.name)}
                    disabled={deleteServer.isPending}
                    className="rounded-lg border border-red-900/50 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-400"
                  >
                    Delete
                  </button>
                  <button onClick={() => setConfirmDelete(null)} className="text-xs text-fg-3">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(s.name)}
                  className="rounded-lg border border-edge p-2 text-fg-3 transition-colors hover:border-red-900/50 hover:text-red-400"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-fg-4">No MCP servers configured.</p>
      )}

      <form onSubmit={(e) => void handleAdd(e)} className="rounded-xl border border-edge bg-surface/50 p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-fg-2">
          <span className="material-symbols-outlined text-accent text-base">add_circle</span>
          Add MCP Server
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required className={inputCls} />
          <input type="text" value={pkg} onChange={(e) => setPkg(e.target.value)} placeholder="Package" required className={inputCls} />
          <input type="text" value={args} onChange={(e) => setArgs(e.target.value)} placeholder='Args JSON (e.g. ["--flag"])' className={inputCls} />
        </div>
        <button
          type="submit"
          disabled={createServer.isPending}
          className="mt-4 flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-bold text-page transition-all hover:bg-accent-hover disabled:opacity-50"
        >
          {createServer.isPending ? <span className="material-symbols-outlined animate-spin text-base">progress_activity</span> : <span className="material-symbols-outlined text-lg">add</span>}
          Add Server
        </button>
      </form>
    </div>
  );
}

function WorkspacesTab() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const deleteWorkspace = useDeleteWorkspace();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function handleDelete(taskId: string) {
    await deleteWorkspace.mutateAsync(taskId);
    setConfirmDelete(null);
  }

  const totalMB = workspaces?.reduce((sum, w) => sum + w.size_mb, 0) ?? 0;

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
              key={w.task_id}
              className="flex items-center justify-between rounded-xl border border-edge bg-surface-alt p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-edge bg-surface">
                  <span className="material-symbols-outlined text-accent/60">folder</span>
                </div>
                <div>
                  <span className="font-mono text-sm text-fg">{w.task_id.slice(0, 12)}...</span>
                  <p className="text-xs text-fg-4">{w.path}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm text-fg-3">{w.size_mb} MB</span>
                {confirmDelete === w.task_id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleDelete(w.task_id)}
                      disabled={deleteWorkspace.isPending}
                      className="rounded-lg border border-red-900/50 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-400"
                    >
                      Delete
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="text-xs text-fg-3">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(w.task_id)}
                    className="rounded-lg border border-edge p-2 text-fg-3 transition-colors hover:border-red-900/50 hover:text-red-400"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-fg-4">No workspaces found.</p>
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
