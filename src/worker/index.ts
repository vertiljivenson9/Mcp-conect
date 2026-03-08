import { GitHubClient } from './github-client.ts';
import { MCPServer } from './mcp-server.ts';

export interface Env {
  GITHUB_TOKEN: string;
  AUTH_TOKEN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  MCP_CACHE: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // === CORS Headers ===
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // === Health Check ===
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // === GitHub OAuth: Login ===
    if (url.pathname === '/auth/github') {
      const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=repo,user&redirect_uri=${url.origin}/auth/callback`;
      return Response.redirect(githubAuthUrl);
    }

    // === GitHub OAuth: Callback ===
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

      // Obtener info de usuario
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

    // === Auth Check ===
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    // Validación token: STATIC AUTH o GitHub OAuth
    const isStaticAuth = token === env.AUTH_TOKEN;
    let githubToken = env.GITHUB_TOKEN; // por defecto
    if (!isStaticAuth) {
      // Verificar que el token de GitHub sea válido
      try {
        const userRes = await fetch('https://api.github.com/user', {
          headers: { Authorization: `token ${token}`, 'User-Agent': 'Cloudflare-Worker-MCP-Server' }
        });
        if (!userRes.ok) throw new Error('GitHub token invalid');
        githubToken = token; // usar el token OAuth para MCPServer
      } catch {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }
    }

    // === SSE Endpoint ===
    if (url.pathname === '/sse') {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

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

    // === Messages Endpoint ===
    if (url.pathname === '/messages' && request.method === 'POST') {
      try {
        const body = await request.json();

        const github = new GitHubClient({
          token: githubToken,
          username: 'default' // o extraer del token OAuth si quieres multiusuario
        });
        const mcp = new MCPServer(github, 'default');

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
