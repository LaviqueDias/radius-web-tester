import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Server,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Shield,
  Loader2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface RadiusServer {
  id: string;
  name: string;
  host: string;
  authPort: number;
  accountingPort: number;
  coaPort: number | null;
  environment: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const ServersPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [servers, setServers] = useState<RadiusServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<RadiusServer | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    authPort: 1812,
    accountingPort: 1813,
    coaPort: 3799,
    sharedSecret: '',
    environment: 'lab',
    isEnabled: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadServers = async () => {
    try {
      const res = await api.get('/servers');
      setServers(res.data.servers);
    } catch (err) {
      console.error('Falha ao carregar servidores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const openCreateModal = () => {
    setEditingServer(null);
    setFormData({
      name: '',
      host: '',
      authPort: 1812,
      accountingPort: 1813,
      coaPort: 3799,
      sharedSecret: '',
      environment: 'lab',
      isEnabled: true,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (server: RadiusServer) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      host: server.host,
      authPort: server.authPort,
      accountingPort: server.accountingPort,
      coaPort: server.coaPort || 3799,
      sharedSecret: '', // Leave empty unless modifying
      environment: server.environment,
      isEnabled: server.isEnabled,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (editingServer) {
        const payload: Record<string, any> = {
          name: formData.name,
          host: formData.host,
          authPort: formData.authPort,
          accountingPort: formData.accountingPort,
          coaPort: formData.coaPort,
          environment: formData.environment,
          isEnabled: formData.isEnabled,
        };
        if (formData.sharedSecret.trim().length > 0) {
          payload.sharedSecret = formData.sharedSecret;
        }
        await api.patch(`/servers/${editingServer.id}`, payload);
      } else {
        await api.post('/servers', formData);
      }
      setModalOpen(false);
      await loadServers();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Erro ao salvar servidor RADIUS.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleServerStatus = async (server: RadiusServer) => {
    if (!isAdmin) return;
    try {
      await api.patch(`/servers/${server.id}`, { isEnabled: !server.isEnabled });
      await loadServers();
    } catch (err) {
      console.error('Erro ao alternar status do servidor:', err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin) return;
    if (!window.confirm(`Tem certeza que deseja remover o servidor '${name}'?`)) return;

    try {
      await api.delete(`/servers/${id}`);
      await loadServers();
    } catch (err) {
      console.error('Erro ao excluir servidor:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Servidores RADIUS Autorizados</h1>
          <p className="text-sm text-slate-400 mt-1">
            Destinos autorizados para envio e testes de pacotes RADIUS. O backend restringe envios apenas a esta lista.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg shadow-blue-600/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Servidor
          </button>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Nome</th>
                <th className="px-5 py-3.5">Host / IP</th>
                <th className="px-5 py-3.5">Portas (Auth / Acct / CoA)</th>
                <th className="px-5 py-3.5">Ambiente</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5">Segredo</th>
                {isAdmin && <th className="px-5 py-3.5 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {servers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    Nenhum servidor RADIUS cadastrado.
                  </td>
                </tr>
              ) : (
                servers.map((server) => (
                  <tr key={server.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-white flex items-center gap-2">
                      <Server className="w-4 h-4 text-blue-400" />
                      {server.name}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-300">{server.host}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-300 font-mono">
                      {server.authPort} / {server.accountingPort} / {server.coaPort || 3799}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase ${
                          server.environment === 'production'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {server.environment}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => toggleServerStatus(server)}
                        disabled={!isAdmin}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          server.isEnabled
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {server.isEnabled ? (
                          <>
                            <Check className="w-3 h-3" /> Habilitado
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3" /> Desabilitado
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>AES-256-GCM Protegido</span>
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3.5 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(server)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(server.id, server.name)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Create/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-semibold text-white">
              {editingServer ? 'Editar Servidor RADIUS' : 'Novo Servidor RADIUS'}
            </h3>

            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nome Amigável</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: FreeRADIUS Lab Local"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Host / Endereço IP</label>
                <input
                  type="text"
                  required
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="Ex: 127.0.0.1 ou radius.lab.local"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Porta Auth</label>
                  <input
                    type="number"
                    required
                    value={formData.authPort}
                    onChange={(e) => setFormData({ ...formData, authPort: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Porta Acct</label>
                  <input
                    type="number"
                    required
                    value={formData.accountingPort}
                    onChange={(e) => setFormData({ ...formData, accountingPort: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Porta CoA</label>
                  <input
                    type="number"
                    value={formData.coaPort}
                    onChange={(e) => setFormData({ ...formData, coaPort: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Shared Secret {editingServer && <span className="text-slate-500">(deixe vazio para manter atual)</span>}
                </label>
                <input
                  type="password"
                  required={!editingServer}
                  value={formData.sharedSecret}
                  onChange={(e) => setFormData({ ...formData, sharedSecret: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Ambiente</label>
                  <select
                    value={formData.environment}
                    onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="lab">Laboratório (lab)</option>
                    <option value="production">Produção (production)</option>
                  </select>
                </div>
                <div className="flex items-center mt-5">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isEnabled}
                      onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="relative w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ms-3 text-xs font-medium text-slate-300">Habilitado</span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingServer ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
