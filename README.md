# GitHub MCP Server & Mobile PWA

Este proyecto contiene un servidor MCP (Model Context Protocol) desplegable en Cloudflare Workers y una interfaz móvil PWA para gestionarlo.

## 📁 Estructura del Proyecto

- `src/worker/`: Código fuente del servidor MCP para Cloudflare Workers.
  - `index.ts`: Punto de entrada del Worker (SSE/HTTP).
  - `mcp-server.ts`: Lógica del protocolo MCP y herramientas.
  - `github-client.ts`: Cliente para la API de GitHub.
  - `types.ts`: Definiciones de tipos TypeScript.
- `src/App.tsx`: Interfaz móvil PWA (React + Tailwind).
- `wrangler.toml`: Configuración de despliegue para Cloudflare.

## 🚀 Despliegue del Servidor (Worker)

1. **Configurar GitHub OAuth**:
   - Crea una OAuth App en GitHub Settings -> Developer Settings.
   - Homepage URL: `https://tu-worker.workers.dev`
   - Callback URL: `https://tu-worker.workers.dev/auth/callback`

2. **Configurar Cloudflare**:
   - Crea un KV Namespace: `wrangler kv:namespace create MCP_CACHE`
   - Actualiza el ID en `wrangler.toml`.
   - Añade las variables de entorno en el Dashboard de Cloudflare o vía CLI:
     ```bash
     wrangler secret put GITHUB_CLIENT_ID
     wrangler secret put GITHUB_CLIENT_SECRET
     wrangler secret put AUTH_TOKEN
     ```

3. **Desplegar**:
   ```bash
   npm run worker:deploy
   ```

## 📱 Uso de la Interfaz Móvil

1. Abre la URL de la aplicación en tu móvil.
2. Ve a **Settings** (icono de engranaje).
3. Introduce el **Worker Endpoint** y pulsa **Login with GitHub**.
4. Una vez autenticado, podrás crear proyectos, listar repositorios y sincronizar cambios desde tu móvil.

## 🤖 Conexión MCP

Para conectar clientes como Claude Desktop:
- **URL**: `https://tu-worker.workers.dev/sse`
- **Auth**: Header `Authorization: Bearer <AUTH_TOKEN>` o el token de GitHub.
