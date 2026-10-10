import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import {
  Server,
  Send,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  ArrowRight,
  Database,
  Terminal,
  Loader2,
} from 'lucide-react';

interface Stats {
  totalExecutions: number;
  successCount: number;
  rejectCount: number;
  timeoutCount: number;
  errorCount: number;
  activeServersCount: number;
  recentExecutions: Array<{
    id: string;
    packetType: string;
    status: string;
    responseCode: string | null;
    durationMs: number;
    createdAt: string;
    server: { name: string };
    user: { username: string };
  }>;
}

interface HealthInfo {
  status: string;
  database: string;
  radclient: {
    path: string;
    installed: boolean;
    versionInfo: string;
  };
}

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsRes, healthRes] = await Promise.all([
          api.get('/executions/stats'),
          api.get('/health'),
        ]);
        setStats(statsRes.data);
        setHealth(healthRes.data);
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Top Welcome / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Painel de Controle RADIUS</h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitoramento de destinos, pacotes enviados e estado da ferramenta local de execução
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/builder"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg shadow-blue-600/20 transition-colors"
          >
            <Send className="w-4 h-4" />
            Novo Teste RADIUS
          </Link>
        </div>
      </div>

      {/* System Health Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-sm font-medium text-slate-300">Estado da Aplicação:</span>
          <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
            {health?.status === 'healthy' ? 'Operacional' : 'Degradado'}
          </span>
        </div>

        <div className="flex items-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-400" />
            <span>PostgreSQL: <strong className="text-slate-200">{health?.database}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-400" />
            <span>
              radclient:{' '}
              <strong className={health?.radclient.installed ? 'text-emerald-400' : 'text-amber-400'}>
                {health?.radclient.installed ? 'Detectado no SO' : 'Ambiente Docker / Host'}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Stats KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Servidores Ativos</span>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Server className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-white">{stats?.activeServersCount || 0}</div>
          <div className="mt-2 text-xs text-slate-500">Destinos autorizados habilitados</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Total de Execuções</span>
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-white">{stats?.totalExecutions || 0}</div>
          <div className="mt-2 text-xs text-slate-500">Pacotes disparados na aplicação</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Respostas Recebidas</span>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-emerald-400">{stats?.successCount || 0}</div>
          <div className="mt-2 text-xs text-slate-500">Accepts e Accounting Responses</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Falhas e Timeouts</span>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-amber-400">
            {(stats?.timeoutCount || 0) + (stats?.rejectCount || 0) + (stats?.errorCount || 0)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {stats?.rejectCount || 0} rejects, {stats?.timeoutCount || 0} timeouts
          </div>
        </div>
      </div>

      {/* Recent Executions Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">Últimas Execuções</h2>
          </div>
          <Link
            to="/history"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
          >
            Ver histórico completo
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Data / Hora</th>
                <th className="px-5 py-3.5">Servidor</th>
                <th className="px-5 py-3.5">Tipo de Pacote</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Duração</th>
                <th className="px-5 py-3.5">Usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {stats?.recentExecutions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    Nenhum pacote RADIUS executado ainda. Use o{' '}
                    <Link to="/builder" className="text-blue-400 underline">
                      Packet Builder
                    </Link>{' '}
                    para disparar o primeiro teste.
                  </td>
                </tr>
              ) : (
                stats?.recentExecutions.map((exec) => (
                  <tr key={exec.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-400">
                      {new Date(exec.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-white">{exec.server.name}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-300">{exec.packetType}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={exec.status} responseCode={exec.responseCode} />
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">{exec.durationMs} ms</td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">{exec.user.username}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
