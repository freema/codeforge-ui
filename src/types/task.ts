export type TaskStatus =
  | "pending"
  | "cloning"
  | "running"
  | "completed"
  | "failed"
  | "awaiting_instruction"
  | "reviewing"
  | "creating_pr"
  | "pr_created"
  | "cancelling";

export interface ReviewResult {
  verdict: "approve" | "request_changes" | "comment";
  score: number;
  summary: string;
  issues: ReviewIssue[];
  auto_fixable: boolean;
  reviewed_by: string;
  duration_seconds: number;
}

export interface ReviewIssue {
  severity: "critical" | "major" | "minor" | "suggestion";
  file: string;
  line?: number;
  description: string;
  suggestion?: string;
}

export interface TaskType {
  name: string;
  label: string;
  description: string;
}

export interface Task {
  id: string;
  status: TaskStatus;
  task_type?: string;
  repo_url: string;
  prompt: string;
  provider_key?: string;
  result?: string;
  error?: string;
  changes_summary?: ChangesSummary;
  usage?: UsageInfo;
  review_result?: ReviewResult;
  config?: TaskConfig;
  iteration: number;
  current_prompt?: string;
  iterations?: Iteration[];
  branch?: string;
  pr_number?: number;
  pr_url?: string;
  trace_id?: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
}

export interface TaskConfig {
  timeout_seconds?: number;
  cli?: string;
  ai_model?: string;
  ai_api_key?: string;
  max_turns?: number;
  source_branch?: string;
  target_branch?: string;
  max_budget_usd?: number;
  workspace_task_id?: string;
  mcp_servers?: MCPServerRef[];
  tools?: TaskToolRef[];
}

export interface TaskToolRef {
  name: string;
  config?: Record<string, string>;
}

export interface CreateTaskRequest {
  repo_url: string;
  prompt: string;
  task_type?: string;
  access_token?: string;
  provider_key?: string;
  callback_url?: string;
  config?: TaskConfig;
}

export interface ChangesSummary {
  files_modified: number;
  files_created: number;
  files_deleted: number;
  diff_stats: string;
}

export interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
  duration_seconds: number;
}

export interface Iteration {
  number: number;
  prompt: string;
  result?: string;
  error?: string;
  status: TaskStatus;
  changes?: ChangesSummary;
  usage?: UsageInfo;
  started_at: string;
  ended_at?: string;
}

export interface MCPServerRef {
  name: string;
}

export interface Repository {
  name: string;
  full_name: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  description?: string;
  updated_at?: string;
}

export interface ToolDefinition {
  name: string;
  type: string;
  description: string;
  mcp_package?: string;
  mcp_command?: string;
  required_config?: ToolConfigField[];
  capabilities?: string[];
  builtin: boolean;
}

export interface ToolConfigField {
  name: string;
  description: string;
  type: string;
  env_var?: string;
  sensitive?: boolean;
}

export interface CLIEntry {
  name: string;
  binary_path: string;
  default_model: string;
  available: boolean;
  is_default: boolean;
}
