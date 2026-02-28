export interface MCPServer {
  name: string;
  package: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface CreateMCPServerRequest {
  name: string;
  package: string;
  args?: string[];
  env?: Record<string, string>;
}
