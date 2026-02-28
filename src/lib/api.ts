import type {
  Task,
  TaskType,
  CreateTaskRequest,
  HealthResponse,
  ProviderKey,
  CreateKeyRequest,
  KeyVerifyResult,
  MCPServer,
  CreateMCPServerRequest,
  Workspace,
  WorkflowDefinition,
  WorkflowRun,
  CreateWorkflowRequest,
  RunWorkflowRequest,
  ReviewResult,
  Repository,
  ToolDefinition,
  CLIEntry,
} from "../types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  serverUrl: string,
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${serverUrl}/api/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

async function requestText(
  serverUrl: string,
  path: string,
  token: string,
): Promise<string> {
  const url = `${serverUrl}/api/v1${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }

  return res.text();
}

export function createApiClient(serverUrl: string, token: string) {
  const get = <T>(path: string) => request<T>(serverUrl, path, token);
  const post = <T>(path: string, body?: unknown) =>
    request<T>(serverUrl, path, token, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  const del = <T>(path: string) =>
    request<T>(serverUrl, path, token, { method: "DELETE" });

  return {
    // Tasks
    listTasks: () =>
      get<{ tasks: Task[] }>("/tasks").then((r) => r.tasks),
    createTask: (req: CreateTaskRequest) => post<Task>("/tasks", req),
    getTask: (id: string, include?: string) =>
      get<Task>(`/tasks/${id}${include ? `?include=${include}` : ""}`),
    cancelTask: (id: string) => post<void>(`/tasks/${id}/cancel`),
    instructTask: (id: string, prompt: string) =>
      post<void>(`/tasks/${id}/instruct`, { prompt }),
    createPR: (
      id: string,
      req?: { title?: string; description?: string; target_branch?: string },
    ) => post<Task>(`/tasks/${id}/create-pr`, req),
    reviewTask: (id: string, req?: { cli?: string; model?: string }) =>
      post<ReviewResult>(`/tasks/${id}/review`, req),

    // Task Types
    listTaskTypes: () =>
      get<{ task_types: TaskType[] }>("/task-types").then((r) => r.task_types),

    // Repositories
    listRepositories: (providerKey: string) =>
      get<{ repositories: Repository[] }>(
        `/repositories?provider_key=${encodeURIComponent(providerKey)}`,
      ).then((r) => r.repositories),

    // Tools
    listToolsCatalog: () =>
      get<{ tools: ToolDefinition[] }>("/tools/catalog").then((r) => r.tools),
    getTool: (name: string) =>
      get<ToolDefinition>(`/tools/${encodeURIComponent(name)}`),

    // CLI
    listCLIs: () => get<{ cli: CLIEntry[] }>("/cli").then((r) => r.cli),

    // Keys
    listKeys: () =>
      get<{ keys: ProviderKey[] }>("/keys").then((r) => r.keys),
    createKey: (req: CreateKeyRequest) => post<void>("/keys", req),
    deleteKey: (name: string) => del<void>(`/keys/${name}`),
    verifyKey: (name: string) => get<KeyVerifyResult>(`/keys/${name}/verify`),

    // MCP Servers
    listMCPServers: () =>
      get<{ servers: MCPServer[] }>("/mcp/servers").then((r) => r.servers),
    createMCPServer: (req: CreateMCPServerRequest) =>
      post<void>("/mcp/servers", req),
    deleteMCPServer: (name: string) => del<void>(`/mcp/servers/${name}`),

    // Workspaces
    listWorkspaces: () =>
      get<{ workspaces: Workspace[] }>("/workspaces").then(
        (r) => r.workspaces,
      ),
    deleteWorkspace: (taskId: string) => del<void>(`/workspaces/${taskId}`),

    // Workflows
    listWorkflows: () =>
      get<{ workflows: WorkflowDefinition[] }>("/workflows").then(
        (r) => r.workflows,
      ),
    getWorkflow: (name: string) =>
      get<WorkflowDefinition>(`/workflows/${encodeURIComponent(name)}`),
    createWorkflow: (req: CreateWorkflowRequest) =>
      post<WorkflowDefinition>("/workflows", req),
    deleteWorkflow: (name: string) =>
      del<void>(`/workflows/${encodeURIComponent(name)}`),

    // Workflow Runs
    runWorkflow: (name: string, req?: RunWorkflowRequest) =>
      post<WorkflowRun>(
        `/workflows/${encodeURIComponent(name)}/run`,
        req,
      ),
    listWorkflowRuns: (workflowName?: string) =>
      get<{ runs: WorkflowRun[] }>(
        `/workflow-runs${workflowName ? `?workflow=${encodeURIComponent(workflowName)}` : ""}`,
      ).then((r) => r.runs),
    getWorkflowRun: (runId: string) =>
      get<WorkflowRun>(`/workflow-runs/${runId}`),

    // Health & Metrics
    getHealth: () => get<HealthResponse>("/health"),
    getMetrics: () => requestText(serverUrl, "/metrics", token),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
