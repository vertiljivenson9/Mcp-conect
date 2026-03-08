export interface GitHubConfig {
  token: string;
  username: string;
}

export type ProjectTemplate = 'basic' | 'python' | 'web' | 'api';

export interface CreateProjectParams {
  project_name: string;
  template: ProjectTemplate;
  description: string;
}

export interface SyncRepoParams {
  repo_name: string;
  action: 'pull' | 'push';
}

export interface ListProjectsParams {
  filter?: string;
}

export interface CommitChangesParams {
  files: { path: string; content: string }[];
  message: string;
  branch?: string;
  repo_name: string;
}

export interface JSONRPCMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}
