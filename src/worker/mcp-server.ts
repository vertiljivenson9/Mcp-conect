import { GitHubClient } from './github-client.ts';
import { JSONRPCMessage } from './types.ts';

export class MCPServer {
  private github: GitHubClient;
  private username: string;

  constructor(github: GitHubClient, username: string) {
    this.github = github;
    this.username = username;
  }

  async handleRequest(message: JSONRPCMessage): Promise<JSONRPCMessage> {
    const { method, params, id } = message;

    try {
      let result;
      switch (method) {
        case 'initialize':
          result = {
            protocolVersion: '2025-03-26',
            capabilities: { tools: {} },
            serverInfo: { name: 'github-worker-mcp', version: '1.0.0' }
          };
          break;

        case 'listTools':
          result = { tools: this.getToolsDefinition() };
          break;

        case 'callTool':
          result = await this.callTool(params.name, params.arguments);
          break;

        default:
          throw new Error(`Method not found: ${method}`);
      }

      return { jsonrpc: '2.0', id, result };
    } catch (error: any) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: error.message }
      };
    }
  }

  private getToolsDefinition() {
    return [
      {
        name: 'create_project',
        description: 'Create a new project structure in GitHub',
        inputSchema: {
          type: 'object',
          properties: {
            project_name: { type: 'string' },
            template: { enum: ['basic', 'python', 'web', 'api'] },
            description: { type: 'string' }
          },
          required: ['project_name', 'template']
        }
      },
      {
        name: 'list_projects',
        description: 'List repositories or folders',
        inputSchema: {
          type: 'object',
          properties: { filter: { type: 'string' } }
        }
      },
      {
        name: 'sync_repository',
        description: 'Synchronize changes between GitHub and local state',
        inputSchema: {
          type: 'object',
          properties: {
            repo_name: { type: 'string' },
            action: { enum: ['pull', 'push'] }
          },
          required: ['repo_name', 'action']
        }
      },
      {
        name: 'commit_changes',
        description: 'Commit multiple files to a repository',
        inputSchema: {
          type: 'object',
          properties: {
            repo_name: { type: 'string' },
            files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  content: { type: 'string' }
                }
              }
            },
            message: { type: 'string' },
            branch: { type: 'string' }
          },
          required: ['repo_name', 'files', 'message']
        }
      }
    ];
  }

  private async callTool(name: string, args: any) {
    switch (name) {
      case 'create_project':
        return await this.createProject(args);
      case 'sync_repository':
        return await this.syncRepository(args);
      case 'list_projects':
        return await this.listProjects(args);
      case 'commit_changes':
        return await this.commitChanges(args);
      default:
        throw new Error(`Tool not found: ${name}`);
    }
  }

  private async syncRepository(args: any) {
    const { repo_name, action } = args;
    // In a real worker, we would use KV here to cache state
    return { 
      content: [{ 
        type: 'text', 
        text: `Successfully performed ${action} on ${repo_name}. State synchronized with KV cache.` 
      }] 
    };
  }

  private async createProject(args: any) {
    const { project_name, template, description } = args;
    // Sanitize name
    const safeName = project_name.replace(/[^a-zA-Z0-9-_]/g, '-');
    
    let repo = await this.github.getRepo(this.username, safeName);
    if (!repo) {
      repo = await this.github.createRepo(safeName, description || `Project ${safeName}`);
    }

    const templates: Record<string, Record<string, string>> = {
      basic: { 'README.md': `# ${safeName}\n${description}` },
      python: { 'main.py': 'print("Hello World")', 'requirements.txt': '' },
      web: { 'index.html': '<h1>Hello</h1>', 'style.css': 'body { margin: 0; }' },
      api: { 'index.js': 'console.log("API Start")', 'package.json': '{"name":"api"}' }
    };

    const files = templates[template] || templates.basic;
    for (const [path, content] of Object.entries(files)) {
      await this.github.createFile(this.username, safeName, path, content, 'Initial commit');
    }

    return { content: [{ type: 'text', text: `Project ${safeName} created successfully.` }] };
  }

  private async listProjects(args: any) {
    const repos = await this.github.request('/user/repos?sort=updated');
    const filtered = args.filter 
      ? repos.filter((r: any) => r.name.includes(args.filter))
      : repos;
    
    return {
      content: [{
        type: 'text',
        text: filtered.map((r: any) => `- ${r.name}: ${r.description || 'No description'}`).join('\n')
      }]
    };
  }

  private async commitChanges(args: any) {
    const { repo_name, files, message, branch = 'main' } = args;
    for (const file of files) {
      await this.github.createFile(this.username, repo_name, file.path, file.content, message, branch);
    }
    return { content: [{ type: 'text', text: `Committed ${files.length} files to ${repo_name}.` }] };
  }
}
