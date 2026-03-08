import { GitHubClient } from './github-client.ts';
import { MCPServer } from './mcp-server.ts';

export interface Env {
  GITHUB_TOKEN: string;
  GITHUB_USERNAME: string;
  AUTH_TOKEN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  MCP_CACHE: any;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health Check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GitHub OAuth: Login
    if (url.pathname === '/auth/github') {
      const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=repo,user&redirect_uri=${url.origin}/auth/callback`;
      return Response.redirect(githubAuthUrl);
    }

    // GitHub OAuth: Callback
    if (url.pathname === '/auth/callback') {
      const code = url.searchParams.get('code');
      if (!code) return new Response('No code provided', { status: 400 });

      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData: any = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Get user info to get the username
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${accessToken}`,
          'User-Agent': 'Cloudflare-Worker-MCP-Server'
        }
      });
      const userData: any = await userResponse.json();

      return new Response(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'GITHUB_AUTH_SUCCESS', 
                  token: '${accessToken}',
                  username: '${userData.login}'
                }, '*');
                window.close();
              } else {
                document.body.innerHTML = 'Authentication successful. You can close this window.';
              }
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Auth Check
    const authHeader = request.headers.get('Authorization');
    const isStaticAuth = authHeader === `Bearer ${env.AUTH_TOKEN}`;
    const isGithubAuth = authHeader?.startsWith('Bearer gh'); 
    
    if (!isStaticAuth && !isGithubAuth) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    // SSE Endpoint
    if (url.pathname === '/sse') {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Send endpoint event
      const endpointUrl = `${url.origin}/messages`;
      writer.write(encoder.encode(`event: endpoint\ndata: ${endpointUrl}\n\n`));

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      });
    }

    // Messages Endpoint
    if (url.pathname === '/messages' && request.method === 'POST') {
      try {
        const body = await request.json();
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '') || env.GITHUB_TOKEN;
        
        // If it's the static token, use the env GITHUB_TOKEN
        // If it's a different token, assume it's a GitHub token from OAuth
        const githubToken = token === env.AUTH_TOKEN ? env.GITHUB_TOKEN : token;

        const github = new GitHubClient({
          token: githubToken,
          username: env.GITHUB_USERNAME // In a multi-user setup, we'd fetch this from the token
        });
        const mcp = new MCPServer(github, env.GITHUB_USERNAME);
        
        const response = await mcp.handleRequest(body as any);
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};
