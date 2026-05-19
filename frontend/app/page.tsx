'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, Box, Activity, ShieldCheck, Terminal, RefreshCw, AlertTriangle, Clock3, Wifi, FileText } from 'lucide-react';

const UPTIME_ROBOT_API_KEYS = (process.env.NEXT_PUBLIC_UPTIME_ROBOT_API_KEYS || '')
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean);

type UptimeRobotLog = {
  type?: number;
  datetime?: number;
  duration?: number;
  reason?: { detail?: string };
};

type UptimeRobotMonitor = {
  id?: number;
  friendly_name?: string;
  url?: string;
  status?: number;
  average_response_time?: number;
  all_time_uptime_ratio?: string;
  custom_uptime_ratio?: string;
  response_times?: { datetime?: number; value?: number }[];
  logs?: UptimeRobotLog[];
};

type MonitorView = {
  key: string;
  name: string;
  url: string;
  statusCode: number;
  statusText: string;
  online: boolean;
  uptime: string;
  responseTime: number | null;
  logs: UptimeRobotLog[];
};

const statusMeta = (status?: number) => {
  switch (status) {
    case 2:
      return { text: '在线', online: true, dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    case 9:
      return { text: '离线', online: false, dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-100' };
    case 8:
      return { text: '疑似故障', online: false, dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-100' };
    case 0:
      return { text: '暂停', online: false, dot: 'bg-slate-400', badge: 'bg-slate-50 text-slate-600 border-slate-100' };
    case 1:
      return { text: '准备中', online: false, dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-100' };
    default:
      return { text: '未知', online: false, dot: 'bg-slate-400', badge: 'bg-slate-50 text-slate-600 border-slate-100' };
  }
};

const formatDateTime = (timestamp?: number) => {
  if (!timestamp) return '-';
  return new Date(timestamp * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (seconds?: number) => {
  if (!seconds) return '瞬时恢复';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} 分钟`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<'docs' | 'status'>('docs');
  const [input, setInput] = useState('nginx:latest');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [configTab, setConfigTab] = useState<'docker' | 'containerd'>('docker');

  const [monitors, setMonitors] = useState<MonitorView[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadUptimeStatus = async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      if (UPTIME_ROBOT_API_KEYS.length === 0) {
        setMonitors([]);
        setLastUpdated(new Date().toLocaleString('zh-CN'));
        return;
      }

      const results = await Promise.all(
        UPTIME_ROBOT_API_KEYS.map(async (apiKey) => {
          const body = new URLSearchParams({
            api_key: apiKey,
            format: 'json',
            response_times: '1',
            response_times_limit: '24',
            logs: '1',
            logs_limit: '10',
            custom_uptime_ratios: '30',
          });

          const res = await fetch('https://api.uptimerobot.com/v2/getMonitors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
          });

          if (!res.ok) {
            throw new Error(`UptimeRobot HTTP ${res.status}`);
          }
          const data = await res.json();
          if (data.stat !== 'ok') {
            throw new Error(data.error?.message || 'UptimeRobot 返回异常');
          }
          return (data.monitors || []) as UptimeRobotMonitor[];
        })
      );

      const views = results.flat().map((monitor, index) => {
        const meta = statusMeta(monitor.status);
        const responseValues = (monitor.response_times || [])
          .map((item) => Number(item.value))
          .filter((value) => Number.isFinite(value) && value > 0);
        const avgResponse = responseValues.length
          ? Math.round(responseValues.reduce((sum, value) => sum + value, 0) / responseValues.length)
          : monitor.average_response_time || null;

        return {
          key: String(monitor.id || `${monitor.friendly_name || 'monitor'}-${index}`),
          name: monitor.friendly_name || '未命名监控',
          url: monitor.url || '-',
          statusCode: monitor.status ?? -1,
          statusText: meta.text,
          online: meta.online,
          uptime: monitor.custom_uptime_ratio || monitor.all_time_uptime_ratio || '-',
          responseTime: avgResponse,
          logs: monitor.logs || [],
        };
      });

      setMonitors(views);
      setLastUpdated(new Date().toLocaleString('zh-CN'));
    } catch (error) {
      console.error(error);
      setStatusError(error instanceof Error ? error.message : '状态获取失败');
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'status' && monitors.length === 0 && !statusLoading) {
      loadUptimeStatus();
    }
  }, [activeTab]);

  const statusSummary = useMemo(() => {
    const total = monitors.length;
    const online = monitors.filter((item) => item.online).length;
    const avg = monitors
      .map((item) => item.responseTime)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    return {
      total,
      online,
      offline: Math.max(total - online, 0),
      avgResponse: avg.length ? Math.round(avg.reduce((sum, value) => sum + value, 0) / avg.length) : null,
    };
  }, [monitors]);
  const convertImage = (text: string) => {
    let trimmed = text.trim();
    if (!trimmed) return '';

    // Remove "docker pull " prefix if user pasted it
    if (trimmed.startsWith('docker pull ')) {
      trimmed = trimmed.replace('docker pull ', '');
    }

    let registry = 'docker.io';
    let imagePath = trimmed;

    const firstSlash = trimmed.indexOf('/');
    // Check if the part before the first slash looks like a registry domain/port
    if (firstSlash !== -1) {
      const potentialRegistry = trimmed.substring(0, firstSlash);
      // Basic check for registry host vs just a namespace
      if (potentialRegistry.includes('.') || potentialRegistry.includes(':') || potentialRegistry === 'localhost') {
        registry = potentialRegistry;
        imagePath = trimmed.substring(firstSlash + 1);
      }
    }

    // Default to library/ for docker.io if no namespace is provided
    if (registry === 'docker.io' && !imagePath.includes('/')) {
      imagePath = 'library/' + imagePath;
    }

    return `cr.gua.cx/${registry}/${imagePath}`;
  };

  const outputUrl = convertImage(input);
  const outputCommand = outputUrl ? `docker pull ${outputUrl}` : '';

  const copyToClipboard = async (text: string, index: number) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const dockerCmd = `sudo mkdir -p /etc/docker
# 注意：如果 /etc/docker/daemon.json 已有其他配置，请手动合并 registry-mirrors，不要直接覆盖。
sudo tee /etc/docker/daemon.json >/dev/null <<'EOF'
{
  "registry-mirrors": ["https://dhub.gua.cx"]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker`;

  const containerdCmd = `# 需要先确认 /etc/containerd/config.toml 已启用：
# [plugins."io.containerd.grpc.v1.cri".registry]
#   config_path = "/etc/containerd/certs.d"
sudo mkdir -p /etc/containerd/certs.d/docker.io
sudo tee /etc/containerd/certs.d/docker.io/hosts.toml >/dev/null <<'EOF'
server = "https://registry-1.docker.io"

[host."https://dhub.gua.cx"]
  capabilities = ["pull", "resolve"]
EOF
sudo systemctl daemon-reload
sudo systemctl restart containerd`;

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Header */}
      <header className="h-16 shrink-0 border-b border-slate-200/70 bg-white/80 backdrop-blur-md px-4 md:px-8 lg:px-10 flex items-center justify-between gap-4 shadow-sm shadow-slate-200/30">
        <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => setActiveTab('docs')}>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Box className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-lg md:text-xl tracking-tight text-slate-800">GUA Hub 镜像加速节点</span>
        </div>
        <nav className="flex w-auto bg-white/70 border border-slate-200/70 rounded-2xl p-1 text-sm font-semibold text-slate-500 shadow-inner shadow-slate-200/40 backdrop-blur">
          {[
            { key: 'docs' as const, label: '使用文档', icon: FileText },
            { key: 'status' as const, label: '服务状态', icon: Activity },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`relative flex-none inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 transition-all duration-300 ease-out ${isActive ? 'bg-white text-blue-600 shadow-md shadow-slate-200/60 scale-[1.01]' : 'hover:text-slate-800 hover:bg-white/70'}`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <div key={activeTab} className="flex-1 w-full overflow-hidden animate-[fadeIn_260ms_ease-out]">
      {activeTab === 'docs' ? (
      <main className="flex-1 overflow-y-auto w-full max-w-[1440px] mx-auto p-4 md:p-6 grid grid-cols-1 xl:grid-cols-12 gap-5 lg:gap-6">
        
        {/* Left: Hero & Converter */}
        <div className="xl:col-span-6 flex flex-col gap-5 lg:gap-6">
          <section className="relative overflow-hidden bg-white rounded-3xl border border-slate-200/80 p-6 md:p-7 shadow-2xl shadow-slate-200/40 flex-1 flex flex-col transition-all duration-300 hover:shadow-blue-100/50">
            <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-blue-50 blur-3xl"></div>
            <div className="relative z-10 flex flex-col flex-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-950 via-slate-800 to-blue-700 mb-3">容器镜像加速服务</h1>
            <p className="text-base text-slate-500 mb-6 leading-relaxed max-w-2xl">为受网络限制影响的地区提供快速、稳定且安全的 Docker Hub、GHCR 和 Quay.io 镜像加速服务。</p>
            
            <div className="space-y-5 flex-1">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-widest">源镜像地址</label>
                <div className="flex gap-2 relative">
                  <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="例如: docker.io/library/nginx:latest"
                    className="flex-1 bg-slate-50/80 border border-slate-200 rounded-2xl px-5 py-4 font-mono text-base focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all duration-200 shadow-inner shadow-slate-100" 
                  />
                  {input && (
                    <button 
                      onClick={() => setInput('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full"
                      title="清除"
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                   <span className="text-xs text-slate-400">试试看:</span>
                   <button onClick={() => setInput('nginx:latest')} className="text-xs text-slate-500 hover:text-blue-600 border border-slate-200 bg-slate-50 px-2 py-0.5 rounded cursor-pointer transition">nginx:latest</button>
                   <button onClick={() => setInput('ghcr.io/linuxserver/jellyfin')} className="text-xs text-slate-500 hover:text-blue-600 border border-slate-200 bg-slate-50 px-2 py-0.5 rounded cursor-pointer transition">ghcr.io/.../jellyfin</button>
                   <button onClick={() => setInput('quay.io/prometheus/prometheus')} className="text-xs text-slate-500 hover:text-blue-600 border border-slate-200 bg-slate-50 px-2 py-0.5 rounded cursor-pointer transition">quay.io/.../prometheus</button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-widest">加速拉取命令</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-slate-400 font-mono text-sm">$</span>
                  </div>
                  <div className="w-full bg-[#0f172a] text-slate-100 rounded-2xl pl-10 pr-28 py-4 font-mono text-base leading-relaxed border border-slate-800 break-all min-h-[70px] flex items-center shadow-2xl shadow-slate-300/30 ring-1 ring-white/5">
                    {input.trim() ? (
                      <span>docker pull <span className="text-blue-400">{outputUrl}</span></span>
                    ) : (
                      <span className="text-slate-500">等待输入或点击上方预设...</span>
                    )}
                  </div>
                  <button 
                    onClick={() => input.trim() && copyToClipboard(outputCommand, 1)}
                    disabled={!input.trim()}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-xs font-semibold text-white px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/25 transition-all duration-200 ${!input.trim() ? 'opacity-30 cursor-not-allowed hover:bg-blue-600 active:scale-100' : 'opacity-95 hover:shadow-blue-500/40'}`}
                  >
                     {copiedIndex === 1 ? '已复制' : '复制'}
                  </button>
                </div>
              </div>
            </div>
            </div>
          </section>

          {/* Method B: Manual Pull */}
          <section className="bg-white/90 border border-slate-200/80 rounded-3xl p-6 md:p-7 shadow-xl shadow-slate-200/30 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200/50">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">手动应用前缀</h2>
            <ul className="grid grid-cols-1 lg:grid-cols-3 gap-4">
               {[
                 { label: "DOCKER", prefix: "cr.gua.cx/docker.io/*", cmd: "docker pull cr.gua.cx/docker.io/library/nginx:latest" },
                 { label: "GHCR", prefix: "cr.gua.cx/ghcr.io/*", cmd: "docker pull cr.gua.cx/ghcr.io/owner/repo:tag" },
                 { label: "QUAY", prefix: "cr.gua.cx/quay.io/*", cmd: "docker pull cr.gua.cx/quay.io/org/repo:tag" }
               ].map((item, i) => (
                  <li key={i} className="group flex flex-col gap-2 bg-slate-50/80 p-4 rounded-2xl border border-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-slate-200/60">
                    <div className="flex items-center justify-between mb-1">
                       <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wider">{item.label}</span>
                       <button 
                           onClick={() => copyToClipboard(item.cmd, 10 + i)}
                            className="text-slate-400 hover:text-blue-600 shrink-0 rounded-lg p-1.5 transition-all duration-300 group-hover:bg-blue-50"
                           title="复制完整拉取命令"
                       >
                           {copiedIndex === 10 + i ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                       </button>
                    </div>
                    <code className="text-xs font-mono text-blue-600 block truncate" title={item.prefix}>{item.prefix}</code>
                 </li>
               ))}
            </ul>
          </section>
        </div>

        {/* Right: Usage Instructions */}
        <div className="xl:col-span-6 flex flex-col gap-5 lg:gap-6 h-full">
          {/* Method A: Global Proxy */}
          <section className="bg-[#0f172a] rounded-3xl p-0 text-slate-300 shadow-2xl shadow-slate-300/30 flex flex-col border border-slate-800 h-full overflow-hidden transition-all duration-300 hover:shadow-blue-950/20">
            <div className="flex items-center gap-2 border-b border-white/10 px-6 py-4 bg-white/[0.03]">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]"></span>
              <span className="h-3 w-3 rounded-full bg-[#ffbd2e]"></span>
              <span className="h-3 w-3 rounded-full bg-[#28c840]"></span>
              <span className="ml-3 text-xs font-mono text-slate-500">global-mirror.conf</span>
            </div>
            <div className="p-6 md:p-7 flex flex-col flex-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">全局镜像配置</h2>
            </div>
            <p className="text-base text-slate-400 mb-5 leading-relaxed">一键配置 Docker 或 Containerd 使用全局加速节点。生产机器如已有配置，请先备份并手动合并。</p>
            
            <div className="flex bg-slate-950/70 border border-slate-800 rounded-2xl p-1 mb-5 w-full sm:w-fit">
              {[
                { key: 'docker' as const, label: 'Docker' },
                { key: 'containerd' as const, label: 'Containerd' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setConfigTab(tab.key)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${configTab === tab.key ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-h-[300px]">
              {/* Docker Config */}
              <div className={`absolute inset-0 transition-all duration-300 ${configTab === 'docker' ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                <div className="flex items-center justify-between mb-2">
                   <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Docker</h3>
                   <button 
                      onClick={() => copyToClipboard(dockerCmd, 2)}
                       className="px-3 py-1.5 text-[10px] bg-slate-800/80 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg border border-slate-700 hover:border-blue-500 transition-all duration-200"
                   >
                      {copiedIndex === 2 ? '已复制！' : '复制命令'}
                   </button>
                </div>
                 <pre className="bg-[#020617] px-5 py-5 rounded-2xl border border-slate-800/90 font-mono text-sm xl:text-[15px] leading-relaxed text-blue-300 overflow-x-auto xl:overflow-x-visible whitespace-pre xl:whitespace-pre-wrap break-normal xl:break-words shadow-inner shadow-black/50 ring-1 ring-white/5 h-full min-h-[260px]">
{dockerCmd}
                </pre>
              </div>

              {/* Containerd Config */}
              <div className={`absolute inset-0 transition-all duration-300 ${configTab === 'containerd' ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                <div className="flex items-center justify-between mb-2">
                   <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                     Containerd
                     <span className="text-[10px] bg-slate-800/50 text-slate-500 px-1.5 py-0.5 rounded font-normal normal-case border border-slate-700/50" title="在 config.toml 中配置 config_path = '/etc/containerd/certs.d'">需开启 config_path</span>
                   </h3>
                   <button 
                      onClick={() => copyToClipboard(containerdCmd, 3)}
                       className="px-3 py-1.5 text-[10px] bg-slate-800/80 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg border border-slate-700 hover:border-blue-500 transition-all duration-200"
                   >
                      {copiedIndex === 3 ? '已复制！' : '复制命令'}
                   </button>
                </div>
                 <pre className="bg-[#020617] px-5 py-5 rounded-2xl border border-slate-800/90 font-mono text-sm xl:text-[15px] leading-relaxed text-blue-300 overflow-x-auto xl:overflow-x-visible whitespace-pre xl:whitespace-pre-wrap break-normal xl:break-words shadow-inner shadow-black/50 ring-1 ring-white/5 h-full min-h-[260px]">
{containerdCmd}
                </pre>
              </div>
            </div>
            </div>
          </section>
        </div>
      </main>
      ) : (
      <main className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto p-4 md:p-6 flex flex-col gap-5 lg:gap-6">
        <section className="bg-white border border-slate-200 rounded-2xl p-6 md:p-7 shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="bg-blue-600 p-3 rounded-xl shrink-0 text-white">
                <Activity className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">服务状态</h1>
                <p className="text-slate-500 mt-1">数据来自 UptimeRobot Monitor-Specific API，页面直连读取公开监控状态。</p>
                <p className="text-xs text-slate-400 mt-2">{lastUpdated ? `最后更新：${lastUpdated}` : '点击刷新获取最新状态'}</p>
              </div>
            </div>
            <button
              onClick={loadUptimeStatus}
              disabled={statusLoading}
              className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors w-fit"
            >
              <RefreshCw className={`w-4 h-4 ${statusLoading ? 'animate-spin' : ''}`} />
              {statusLoading ? '刷新中' : '刷新状态'}
            </button>
          </div>
        </section>

        {statusError && (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-4 flex items-start gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">状态获取失败</div>
              <div className="text-red-600 mt-1">{statusError}</div>
            </div>
          </div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: '监控项', value: statusSummary.total || '-', icon: ShieldCheck, color: 'text-blue-600 bg-blue-50' },
            { label: '在线', value: statusSummary.online, icon: Wifi, color: 'text-emerald-600 bg-emerald-50' },
            { label: '异常', value: statusSummary.offline, icon: AlertTriangle, color: statusSummary.offline ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-50' },
            { label: '平均响应', value: statusSummary.avgResponse ? `${statusSummary.avgResponse} ms` : '-', icon: Clock3, color: 'text-violet-600 bg-violet-50' },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{item.label}</span>
                  <span className={`p-2 rounded-lg ${item.color}`}><Icon className="w-4 h-4" /></span>
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-4">{item.value}</div>
              </div>
            );
          })}
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="px-8 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
            <h2 className="font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              监控端点
            </h2>
            <span className="text-xs text-slate-400">30 天可用率</span>
          </div>
          <div className="divide-y divide-slate-100">
            {statusLoading && monitors.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">正在从 UptimeRobot 获取状态...</div>
            ) : monitors.length > 0 ? monitors.map((service) => {
              const meta = statusMeta(service.statusCode);
              return (
                <div key={service.key} className="px-8 py-6 hover:bg-slate-50 transition-colors duration-200">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-800 font-semibold">{service.name}</span>
                        <span className={`font-medium text-xs flex items-center gap-1.5 px-2.5 py-1 rounded border ${meta.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}></span>
                          {service.statusText}
                        </span>
                      </div>
                      <code className="text-xs text-blue-600 font-mono break-all block mt-1">{service.url}</code>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm shrink-0">
                      <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Uptime</div>
                        <div className="font-bold text-slate-800 mt-1">{service.uptime}%</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">响应</div>
                        <div className="font-bold text-slate-800 mt-1">{service.responseTime ? `${service.responseTime} ms` : '-'}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 col-span-2 sm:col-span-1">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">状态码</div>
                        <div className="font-bold text-slate-800 mt-1">{service.statusCode}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-1" aria-label="uptime timeline">
                    {Array.from({ length: 30 }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-2 flex-1 rounded-full ${service.online ? 'bg-emerald-400' : idx > 25 ? 'bg-red-400' : 'bg-emerald-300'}`}
                        title="UptimeRobot Monitor-Specific API 当前仅展示聚合可用率"
                      />
                    ))}
                  </div>

                  {service.logs.length > 0 && (
                    <div className="mt-4 bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <div className="text-xs font-bold text-slate-500 mb-2">最近事件</div>
                      <div className="space-y-2">
                        {service.logs.slice(0, 3).map((log, idx) => (
                          <div key={idx} className="text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span>{formatDateTime(log.datetime)} · {log.reason?.detail || (log.type === 1 ? '故障' : log.type === 2 ? '恢复' : '状态变更')}</span>
                            <span className="text-slate-400">{formatDuration(log.duration)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">暂无监控数据</div>
            )}
          </div>
        </section>

        <div className="bg-slate-900 rounded-2xl p-8 md:p-10 text-slate-300 shadow-xl border border-slate-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            建议验证命令
          </h2>
          <pre className="bg-slate-950 px-5 py-5 rounded-xl border border-slate-800 font-mono text-sm leading-relaxed text-blue-300 overflow-x-auto whitespace-pre">{`curl -I https://cr.gua.cx/v2/
curl -I https://dhub.gua.cx/v2/
docker pull cr.gua.cx/docker.io/library/busybox:latest
docker pull dhub.gua.cx/library/busybox:latest`}</pre>
          <p className="text-xs text-slate-500 mt-3">说明：状态页直接读取 UptimeRobot Monitor-Specific API；镜像代理链路仍由 nginx 的 /v2/ 规则优先转发。</p>
        </div>
      </main>
      )}
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Footer Bar */}
      <footer className="h-12 bg-white border-t border-slate-200 px-4 md:px-8 mt-auto flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 md:gap-6 text-[10px] md:text-[11px] font-medium text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            <span className="whitespace-nowrap">所有节点运行正常</span>
          </div>
        </div>
        <div className="text-[10px] md:text-[11px] text-slate-400 text-right">
          &copy; {new Date().getFullYear()} GUA Hub. 仅限非商业个人使用。
        </div>
      </footer>
    </div>
  );
}
