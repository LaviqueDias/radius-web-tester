import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
  Bookmark,
  Send,
  Trash2,
  Plus,
  X,
  Layers,
  Loader2,
  Clock,
  User,
  ArrowRight,
} from 'lucide-react';

interface PacketTemplate {
  id: string;
  name: string;
  description: string | null;
  packetType: string;
  attributesJson: Array<{ name: string; value: string }>;
  createdBy: { username: string };
  createdAt: string;
}

export const TemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<PacketTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadTemplates = async () => {
    try {
      const res = await api.get('/templates');
      setTemplates(res.data.templates);
    } catch (err) {
      console.error('Falha ao carregar modelos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleUseTemplate = (template: PacketTemplate) => {
    navigate('/builder', { state: { template } });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o modelo '${name}'?`)) return;

    try {
      await api.delete(`/templates/${id}`);
      setTemplates(templates.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Erro ao excluir template:', err);
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
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Modelos de Pacotes (Templates)</h1>
          <p className="text-sm text-slate-400 mt-1">
            Modelos pré-configurados de atributos para agilizar testes repetitivos de autenticação e contabilização
          </p>
        </div>

        <button
          onClick={() => navigate('/builder')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg shadow-blue-600/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Modelo via Builder
        </button>
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
            Nenhum modelo cadastrado. Monte uma lista no Packet Builder e salve como modelo.
          </div>
        ) : (
          templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between transition-all group shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {tpl.packetType}
                  </span>

                  <button
                    onClick={() => handleDelete(tpl.id, tpl.name)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title="Excluir modelo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h3 className="mt-3 text-base font-semibold text-white group-hover:text-blue-400 transition-colors">
                  {tpl.name}
                </h3>
                <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                  {tpl.description || 'Sem descrição cadastrada.'}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    {tpl.attributesJson?.length || 0} atributos
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {tpl.createdBy?.username || 'admin'}
                  </span>
                </div>
              </div>

              <div className="mt-5">
                <button
                  onClick={() => handleUseTemplate(tpl)}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  Carregar no Packet Builder
                  <ArrowRight className="w-3 h-3 ml-1" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
