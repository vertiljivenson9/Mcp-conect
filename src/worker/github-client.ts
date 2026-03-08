import { GitHubConfig } from './types.ts';

export class GitHubClient {
  private baseUrl = 'https://api.github.com';
  private headers: HeadersInit;

  constructor(config: GitHubConfig) {
    this.headers = {
      'Authorization': `token ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Cloudflare-Worker-MCP-Server'
    };
  }

  async request(path: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.headers, ...options.headers }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`GitHub API Error: ${response.status} - ${JSON.stringify(error)}`);
    }

    return response.status === 204 ? null : response.json();
  }

  async getRepo(owner: string, repo: string) {
    try {
      return await this.request(`/repos/${owner}/${repo}`);
    } catch (e) {
      return null;
    }
  }

  async createRepo(name: string, description: string) {
    return this.request('/user/repos', {
      method: 'POST',
      body: JSON.stringify({ name, description, auto_init: true })
    });
  }

  async createFile(owner: string, repo: string, path: string, content: string, message: string, branch: string = 'main') {
    return this.request(`/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: btoa(content),
        branch
      })
    });
  }

  async listContents(owner: string, repo: string, path: string = '') {
    return this.request(`/repos/${owner}/${repo}/contents/${path}`);
  }
}
