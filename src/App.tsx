import React, { useState, useEffect } from 'react';
import { 
  Github, 
  Plus, 
  RefreshCw, 
  List, 
  Send, 
  Settings, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type View = 'dashboard' | 'create' | 'list' | 'settings';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('mcp_token') || '');
  const [username, setUsername] = useState(localStorage.getItem('github_username') || '');
  const [endpoint, setEndpoint] = useState(localStorage.getItem('mcp_endpoint') || '');
  const [view, setView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [projects, setProjects] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem('mcp_token', token);
    localStorage.setItem('github_username', username);
    localStorage.setItem('mcp_endpoint', endpoint);
  }, [token, username, endpoint]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        setToken(event.data.token);
        setUsername(event.data.username);
        setStatus({ type: 'success', message: `Logged in as ${event.data.username}` });
        setView('dashboard');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleGithubLogin = () => {
    if (!endpoint) {
      setStatus({ type: 'error', message: 'Set Worker Endpoint first' });
      return;
    }
    const width = 600, height = 700;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    window.open(
      `${endpoint}/auth/github`,
      'github_oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  const callMCP = async (method: string, params: any) => {
    if (!endpoint || !token) {
      setStatus({ type: 'error', message: 'Configure endpoint and token first' });
      return null;
    }
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(`${endpoint}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now().toString(),
          method: 'callTool',
          params: { name: method, arguments: params }
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.result;
    } catch (e: any) {
      setStatus({ type: 'error', message: e.message });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const result = await callMCP('create_project', {
      project_name: formData.get('name'),
      template: formData.get('template'),
      description: formData.get('description')
    });
    if (result) {
      setStatus({ type: 'success', message: result.content[0].text });
      setView('dashboard');
    }
  };

  const fetchProjects = async () => {
    const result = await callMCP('list_projects', {});
    if (result) {
      const lines = result.content[0].text.split('\n');
      setProjects(lines);
      setView('list');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Github className="text-black w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">GitHub MCP</h1>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
              {username ? `Logged in as ${username}` : 'Mobile Interface'}
            </p>
          </div>
        </div>
        <button 
          onClick={() => setView('settings')}
          className="p-2 hover:bg-white/5 rounded-full transition-colors"
        >
          <Settings className={`w-5 h-5 ${!token || !endpoint ? 'text-amber-400 animate-pulse' : 'text-white/60'}`} />
        </button>
      </header>

      <main className="max-w-md mx-auto p-6 pb-24">
        <AnimatePresence mode="wait">
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`mb-6 p-4 rounded-2xl flex items-center gap-3 border ${
                status.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <p className="text-sm font-medium">{status.message}</p>
            </motion.div>
          )}

          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid gap-4"
            >
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-2">
                <h2 className="text-2xl font-light mb-1">Welcome back</h2>
                <p className="text-white/40 text-sm">Manage your GitHub projects via MCP</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <MenuButton 
                  icon={<Plus />} 
                  label="New Project" 
                  color="bg-emerald-500" 
                  onClick={() => setView('create')} 
                />
                <MenuButton 
                  icon={<List />} 
                  label="My Projects" 
                  color="bg-blue-500" 
                  onClick={fetchProjects} 
                />
                <MenuButton 
                  icon={<RefreshCw />} 
                  label="Sync Repo" 
                  color="bg-purple-500" 
                  onClick={() => setStatus({ type: 'success', message: 'Sync started...' })} 
                />
                <MenuButton 
                  icon={<Send />} 
                  label="Commit" 
                  color="bg-orange-500" 
                  onClick={() => setStatus({ type: 'error', message: 'Select a project first' })} 
                />
              </div>
            </motion.div>
          )}

          {view === 'create' && (
            <motion.div 
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/5 border border-white/10 rounded-3xl p-6"
            >
              <h2 className="text-xl font-semibold mb-6">Create Project</h2>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Project Name</label>
                  <input 
                    name="name" 
                    required 
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-colors"
                    placeholder="my-awesome-app"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Template</label>
                  <select 
                    name="template" 
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none appearance-none"
                  >
                    <option value="basic">Basic README</option>
                    <option value="python">Python Script</option>
                    <option value="web">Web Frontend</option>
                    <option value="api">Node.js API</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Description</label>
                  <textarea 
                    name="description" 
                    rows={3}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-colors"
                    placeholder="What is this project about?"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setView('dashboard')}
                    className="flex-1 py-4 rounded-2xl bg-white/5 font-semibold hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={loading}
                    className="flex-1 py-4 rounded-2xl bg-emerald-500 text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {view === 'list' && (
            <motion.div 
              key="list"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Repositories</h2>
                <button onClick={() => setView('dashboard')} className="text-sm text-emerald-500">Back</button>
              </div>
              {projects.map((p, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group active:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium">{p.replace('- ', '')}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20" />
                </div>
              ))}
            </motion.div>
          )}

          {view === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 rounded-3xl p-6"
            >
              <h2 className="text-xl font-semibold mb-6">MCP Configuration</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Worker Endpoint</label>
                  <input 
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none"
                    placeholder="https://your-worker.workers.dev"
                  />
                </div>
                
                <div className="pt-2">
                  <button 
                    onClick={handleGithubLogin}
                    className="w-full py-4 rounded-2xl bg-white text-black font-bold flex items-center justify-center gap-3 hover:bg-white/90 transition-colors"
                  >
                    <Github className="w-5 h-5" />
                    Login with GitHub
                  </button>
                  <p className="text-[10px] text-center text-white/30 mt-3 uppercase tracking-widest font-bold">Or enter token manually</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Auth Token / GitHub Token</label>
                  <input 
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none"
                    placeholder="Your AUTH_TOKEN or gh_..."
                  />
                </div>
                <button 
                  onClick={() => setView('dashboard')}
                  className="w-full py-4 rounded-2xl bg-emerald-500 text-black font-bold mt-4"
                >
                  Save & Close
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A]/80 backdrop-blur-2xl border-t border-white/5 px-8 py-4 flex justify-between items-center safe-area-bottom">
        <TabItem active={view === 'dashboard'} icon={<Github />} onClick={() => setView('dashboard')} />
        <TabItem active={view === 'create'} icon={<Plus />} onClick={() => setView('create')} />
        <TabItem active={view === 'list'} icon={<List />} onClick={fetchProjects} />
        <TabItem active={view === 'settings'} icon={<Settings />} onClick={() => setView('settings')} />
      </nav>
    </div>
  );
}

function MenuButton({ icon, label, color, onClick }: { icon: React.ReactNode, label: string, color: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col items-start gap-4 active:scale-95 transition-all hover:bg-white/10"
    >
      <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center text-black shadow-lg`}>
        {React.cloneElement(icon as React.ReactElement, { size: 24 })}
      </div>
      <span className="text-sm font-semibold text-white/80">{label}</span>
    </button>
  );
}

function TabItem({ active, icon, onClick }: { active: boolean, icon: React.ReactNode, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`p-2 transition-all ${active ? 'text-emerald-500 scale-110' : 'text-white/20'}`}>
      {React.cloneElement(icon as React.ReactElement, { size: 24 })}
    </button>
  );
}

