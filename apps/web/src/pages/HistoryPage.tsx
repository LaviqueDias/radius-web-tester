import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import {
  History,
  Filter,
  Eye,
  Trash2,
  X,
  Clock,
  Server,
  User,
  Terminal,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface ExecutionItem {
  id: string;
  packetType: string;
  status: string;
  responseCode: string | null;
  durationMs: number;
  exitCode: number | null;
  createdAt: string;
  user: { id: string; username: string };
  server: { id: string; name: string; host: string; environment: string };
}

interface ExecutionDetail extends ExecutionItem {
  stdoutRedacted: string | null;
  stderrRedacted: string | null;
  optionsJson: any;
  attributesJson: any[];
}

export const HistoryPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [executions, setExecutions] = useState<ExecutionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [servers, setServers] = useState<Array<{ id: string; name: string }>>([]);
  const [filterServer, setFilterServer] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [selectedExecution, setSelectedExecution] = useState<ExecutionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [purgeDays, setPurgeDays] = useState(30);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '15');
      if (filterServer) params.append('serverId', filterServer);
      if (filterType) params.append('packetType', filterType);
      if (filterStatus) params.append('status', filterStatus);

      const [historyRes, serversRes] = await Promise.all([
        api.get(`/executions?${params.toString()}`),
        api.get('/servers'),
      ]);

      setExecutions(historyRes.data.executions);
      setTotalPages(historyRes.data.totalPages);
      setTotalCount(historyRes.data.total);
      setServers(serversRes.data.servers);
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, filterServer, filterType, filterStatus]);

  const viewDetails = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/executions/${id}`);
      setSelectedExecution(res.data.execution);
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePurge = async () => {
    try {
      const res = await api.post('/executions/purge', { days: purgeDays });
      alert(res.data.message);
      setPurgeModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao realizar expurgo.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Histórico de Execuções</h1>
          <p className="text-sm text-slate-400 mt-1">
            Auditoria e registro de todos os testes RADIUS disparados pela equipe ({totalCount} registros)
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setPurgeModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Expurgo do Histórico
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mr-2">
          <Filter className="w-4 h-4 text-blue-400" />
          Filtros:
        </div>

        {/* Server filter */}
        <select
          value={filterServer}
          onChange={(e) => {
            setFilterServer(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todos os Servidores</option>
          {servers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todos os Tipos de Pacote</option>
          <option value="access-request">Access-Request</option>
          <option value="accounting-start">Accounting-Start</option>
          <option value="accounting-stop">Accounting-Stop</option>
          <option value="accounting-interim-update">Accounting-Interim-Update</option>
          <option value="coa-request">CoA-Request</option>
          <option value="disconnect-request">Disconnect-Request</option>
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todos os Status</option>
          <option value="response_received">Resposta Recebida</option>
          <option value="rejected">Rejeitado</option>
          <option value="timeout">Timeout</option>
          <option value="execution_error">Erro de Execução</option>
          <option value="invalid_response">Não Reconhecido</option>
        </select>
      </div>

      {/* History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Data / Hora</th>
                <th className="px-5 py-3.5">Usuário</th>
                <th className="px-5 py-3.5">Servidor Destino</th>
                <th className="px-5 py-3.5">Tipo de Pacote</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Duração</th>
                <th className="px-5 py-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    Carregando histórico...
                  </td>
                </tr>
              ) : executions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    Nenhum registro encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                executions.map((exec) => (
                  <tr key={exec.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(exec.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-300 font-medium">
                      {exec.user?.username || 'Sistema'}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-white">{exec.server.name}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-300">{exec.packetType}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={exec.status} responseCode={exec.responseCode} />
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">{exec.durationMs} ms</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => viewDetails(exec.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Página {page} de {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedExecution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedExecution(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              Detalhes da Execução RADIUS
            </h3>

            <div className="mt-4 grid grid-cols-2 gap-4 text-xs bg-slate-950 p-4 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-500 block">ID:</span>
                <span className="font-mono text-slate-300">{selectedExecution.id}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Status:</span>
                <StatusBadge
                  status={selectedExecution.status}
                  responseCode={selectedExecution.responseCode}
                />
              </div>
              <div>
                <span className="text-slate-500 block">Servidor:</span>
                <span className="text-white font-medium">{selectedExecution.server.name} ({selectedExecution.server.host})</span>
              </div>
              <div>
                <span className="text-slate-500 block">Duração:</span>
                <span className="text-white font-mono">{selectedExecution.durationMs} ms</span>
              </div>
              <div>
                <span className="text-slate-500 block">Tipo de Pacote:</span>
                <span className="text-white font-mono">{selectedExecution.packetType}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Data/Hora:</span>
                <span className="text-white">{new Date(selectedExecution.createdAt).toLocaleString('pt-BR')}</span>
              </div>
            </div>

            {/* Sanitized Attributes Sent */}
            <div className="mt-5 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Atributos Enviados (Sanitizados)
              </h4>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs max-h-40 overflow-y-auto space-y-1">
                {selectedExecution.attributesJson?.map((attr: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-blue-400">{attr.name}</span>
                    <span className="text-slate-300">{attr.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Output */}
            <div className="mt-5 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Saída Registrada
              </h4>
              <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {selectedExecution.stdoutRedacted || selectedExecution.stderrRedacted || '// Sem saída registrada'}
              </pre>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedExecution(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge Modal */}
      <ConfirmModal
        isOpen={purgeModalOpen}
        isDestructive={true}
        title="Expurgar Histórico Antigo"
        message={`Esta ação irá remover permanentemente todas as execuções RADIUS anteriores a ${purgeDays} dias. Deseja continuar?`}
        confirmText="Sim, Expurgar"
        cancelText="Cancelar"
        onConfirm={handlePurge}
        onCancel={() => setPurgeModalOpen(false)}
      />
    </div>
  );
};
