import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  PacketType,
  PACKET_TYPES_METADATA,
  POPULAR_RADIUS_ATTRIBUTES,
  SUGGESTED_ATTRIBUTES,
  RadiusAttribute,
  validateAcctStatusConsistency,
} from '@radius-web/shared';
import {
  Send,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  Bookmark,
  AlertTriangle,
  CheckCircle,
  Copy,
  Clock,
  Terminal,
  Loader2,
  Server as ServerIcon,
  Layers,
  Save,
  Check,
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
}

interface PacketTemplate {
  id: string;
  name: string;
  packetType: string;
  attributesJson: RadiusAttribute[];
}

interface ExecutionResult {
  executionId: string;
  status: string;
  packetType: string;
  destination: string;
  host: string;
  port: number;
  durationMs: number;
  responseCode: string | null;
  summary: string;
  attributes: Array<{ name: string; value: string }>;
  stdout: string;
  stderr: string;
  createdAt: string;
}

export const PacketBuilderPage: React.FC = () => {
  const location = useLocation();

  // Servers & Templates
  const [servers, setServers] = useState<RadiusServer[]>([]);
  const [templates, setTemplates] = useState<PacketTemplate[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');

  // Packet configuration
  const [packetType, setPacketType] = useState<PacketType>(PacketType.ACCOUNTING_START);
  const [attributes, setAttributes] = useState<RadiusAttribute[]>(
    SUGGESTED_ATTRIBUTES[PacketType.ACCOUNTING_START]
  );
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(3);
  const [retries, setRetries] = useState<number>(2);

  // Stdin Live Preview
  const [previewStdin, setPreviewStdin] = useState<string>('');
  const [consistencyError, setConsistencyError] = useState<string | null>(null);

  // Execution states
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [disruptiveModalOpen, setDisruptiveModalOpen] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState<'attributes' | 'raw'>('attributes');
  const [copiedRaw, setCopiedRaw] = useState(false);

  // Save template modal
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');

  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        const [serversRes, templatesRes] = await Promise.all([
          api.get('/servers?enabledOnly=true'),
          api.get('/templates'),
        ]);
        setServers(serversRes.data.servers);
        if (serversRes.data.servers.length > 0) {
          setSelectedServerId(serversRes.data.servers[0].id);
        }
        setTemplates(templatesRes.data.templates);

        // If navigated with template in state
        if (location.state?.template) {
          const t = location.state.template;
          setPacketType(t.packetType as PacketType);
          setAttributes(t.attributesJson);
        }
      } catch (err) {
        console.error('Erro ao inicializar Packet Builder:', err);
      }
    }
    loadData();
  }, [location.state]);

  // Update live preview & validate consistency whenever packetType or attributes change
  useEffect(() => {
    const consistency = validateAcctStatusConsistency(packetType, attributes);
    if (!consistency.valid) {
      setConsistencyError(consistency.message || 'Inconsistência nos atributos');
    } else {
      setConsistencyError(null);
    }

    // Update preview
    api
      .post('/packets/preview', { packetType, attributes })
      .then((res) => setPreviewStdin(res.data.previewStdin))
      .catch(() => {
        // Fallback local preview
        const local = attributes
          .map((a) => `${a.name} = ${a.isSensitive ? '***REDACTED***' : a.value}`)
          .join('\n');
        setPreviewStdin(local);
      });
  }, [packetType, attributes]);

  // Handle changing packet type
  const handleTypeChange = (newType: PacketType) => {
    setPacketType(newType);
    setAttributes(SUGGESTED_ATTRIBUTES[newType] || []);
    setResult(null);
  };

  // Add attribute
  const addAttribute = () => {
    setAttributes([...attributes, { name: '', value: '', operator: '=', isSensitive: false }]);
  };

  // Update attribute
  const updateAttribute = (index: number, field: keyof RadiusAttribute, value: any) => {
    const updated = [...attributes];
    updated[index] = { ...updated[index], [field]: value };
    setAttributes(updated);
  };

  // Remove attribute
  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  // Reset to default suggested attributes
  const resetDefaults = () => {
    setAttributes(SUGGESTED_ATTRIBUTES[packetType] || []);
  };

  // Apply template
  const applyTemplate = (templateId: string) => {
    const t = templates.find((tpl) => tpl.id === templateId);
    if (t) {
      setPacketType(t.packetType as PacketType);
      setAttributes(t.attributesJson);
    }
  };

  // Save current attributes as a template
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName) return;

    try {
      const res = await api.post('/templates', {
        name: templateName,
        description: templateDesc,
        packetType,
        attributes,
      });
      setTemplates([...templates, res.data.template]);
      setSaveTemplateOpen(false);
      setTemplateName('');
      setTemplateDesc('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao salvar modelo.');
    }
  };

  // Execute packet send
  const executeSend = async (confirmedDisruptive = false) => {
    if (!selectedServerId) {
      alert('Selecione um servidor RADIUS habilitado.');
      return;
    }

    const meta = PACKET_TYPES_METADATA[packetType];
    if (meta.isDisruptive && !confirmedDisruptive) {
      setDisruptiveModalOpen(true);
      return;
    }

    setDisruptiveModalOpen(false);
    setIsExecuting(true);
    setResult(null);

    try {
      const response = await api.post('/packets/send', {
        serverId: selectedServerId,
        packetType,
        attributes,
        options: {
          timeoutSeconds,
          retries,
        },
        disruptiveConfirmed: confirmedDisruptive,
      });
      setResult(response.data);
    } catch (err: any) {
      const errData = err.response?.data;
      setResult({
        executionId: 'erro',
        status: 'execution_error',
        packetType,
        destination: 'Servidor',
        host: '',
        port: 0,
        durationMs: 0,
        responseCode: null,
        summary: errData?.error || 'Falha na requisição ao backend.',
        attributes: [],
        stdout: '',
        stderr: errData?.error || String(err),
        createdAt: new Date().toISOString(),
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const selectedServer = servers.find((s) => s.id === selectedServerId);
  const meta = PACKET_TYPES_METADATA[packetType];

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Packet Builder (Editor RADIUS)</h1>
          <p className="text-sm text-slate-400 mt-1">
            Monte requisições, configure atributos e despache testes de forma segura com radclient
          </p>
        </div>

        <div className="flex items-center gap-2">
          {templates.length > 0 && (
            <select
              onChange={(e) => applyTemplate(e.target.value)}
              defaultValue=""
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Carregar Modelo...
              </option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} ({tpl.packetType})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setSaveTemplateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5" />
            Salvar como Modelo
          </button>
        </div>
      </div>

      {/* Main Grid: Builder Form + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form & Attributes (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: Destination Server and Packet Type */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <ServerIcon className="w-4 h-4 text-blue-400" />
              1. Destino e Tipo de Pacote
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Servidor Autorizado
                </label>
                <select
                  value={selectedServerId}
                  onChange={(e) => setSelectedServerId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {servers.length === 0 ? (
                    <option value="" disabled>
                      Nenhum servidor habilitado
                    </option>
                  ) : (
                    servers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.host}) [{s.environment}]
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Tipo de Pacote RADIUS
                </label>
                <select
                  value={packetType}
                  onChange={(e) => handleTypeChange(e.target.value as PacketType)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                >
                  {Object.values(PACKET_TYPES_METADATA).map((m) => (
                    <option key={m.type} value={m.type}>
                      {m.label} {m.isDisruptive ? '⚠️ (Disruptivo)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description & Target Port info */}
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs text-slate-300 flex items-start justify-between gap-4">
              <div>
                <span className="font-semibold text-white">{meta.label}: </span>
                <span>{meta.description}</span>
              </div>
              {selectedServer && (
                <div className="shrink-0 text-right font-mono text-slate-400">
                  Modo radclient: <strong className="text-blue-400">{meta.defaultMode}</strong> | Porta:{' '}
                  <strong className="text-blue-400">
                    {meta.portField === 'authPort'
                      ? selectedServer.authPort
                      : meta.portField === 'accountingPort'
                      ? selectedServer.accountingPort
                      : selectedServer.coaPort || 3799}
                  </strong>
                </div>
              )}
            </div>

            {meta.isDisruptive && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Atenção:</strong> Pacotes de CoA e Disconnect podem desconectar assinantes reais ou alterar
                  sessões ativas em produção. O envio exigirá confirmação explícita.
                </span>
              </div>
            )}
          </div>

          {/* Card: Attributes Builder */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                2. Atributos RADIUS ({attributes.length})
              </h2>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetDefaults}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                  title="Restaurar atributos recomendados para este tipo"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Restaurar Padrões
                </button>
                <button
                  type="button"
                  onClick={addAttribute}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar
                </button>
              </div>
            </div>

            {consistencyError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{consistencyError}</span>
              </div>
            )}

            {/* Datalist for attribute auto-complete */}
            <datalist id="radius-attributes-list">
              {POPULAR_RADIUS_ATTRIBUTES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            {/* Attributes list */}
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {attributes.map((attr, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-slate-950/60 border border-slate-800 rounded-lg group hover:border-slate-700 transition-colors"
                >
                  {/* Name with datalist */}
                  <div className="flex-1 min-w-[140px]">
                    <input
                      type="text"
                      list="radius-attributes-list"
                      placeholder="Nome do Atributo"
                      value={attr.name}
                      onChange={(e) => updateAttribute(idx, 'name', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Operator */}
                  <div className="w-12 text-center text-xs font-mono text-slate-400">
                    <span>=</span>
                  </div>

                  {/* Value */}
                  <div className="flex-[1.5] min-w-[160px]">
                    <input
                      type={attr.isSensitive ? 'password' : 'text'}
                      placeholder="Valor"
                      value={attr.value}
                      onChange={(e) => updateAttribute(idx, 'value', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Sensitive toggle */}
                  <button
                    type="button"
                    title={attr.isSensitive ? 'Atributo sensível (oculto)' : 'Marcar como sensível'}
                    onClick={() => updateAttribute(idx, 'isSensitive', !attr.isSensitive)}
                    className={`p-1.5 rounded transition-colors ${
                      attr.isSensitive ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {/* Remove button */}
                  <button
                    type="button"
                    title="Remover atributo"
                    onClick={() => removeAttribute(idx)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Execution Options: Timeout and Retries */}
            <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Timeout (segundos): {timeoutSeconds}s
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={timeoutSeconds}
                  onChange={(e) => setTimeoutSeconds(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Retentativas: {retries}
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={retries}
                  onChange={(e) => setRetries(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isExecuting || !!consistencyError || !selectedServerId || attributes.length === 0}
                onClick={() => executeSend(false)}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
                  meta.isDisruptive
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/25'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Executando radclient...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {meta.isDisruptive ? 'Disparar Pacote Disruptivo...' : 'Enviar Pacote RADIUS'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Stdin Preview & Result Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card: Live Stdin Preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                Pré-visualização (stdin)
              </h2>
              <span className="text-xs text-slate-500 font-mono">FreeRADIUS stdin format</span>
            </div>

            <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-emerald-400 font-mono overflow-x-auto max-h-56 leading-relaxed">
              {previewStdin || '// Nenhum atributo configurado'}
            </pre>
          </div>

          {/* Card: Execution Result */}
          {result && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-top-4">
              <div className="p-5 border-b border-slate-800 bg-slate-950/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <StatusBadge status={result.status} responseCode={result.responseCode} />
                    <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {result.durationMs} ms
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{result.destination}</span>
                </div>

                <div className="mt-3 text-sm font-medium text-white">{result.summary}</div>
              </div>

              {/* Result Tabs */}
              <div className="border-b border-slate-800 flex bg-slate-950/20 text-xs font-medium">
                <button
                  onClick={() => setActiveResultTab('attributes')}
                  className={`flex-1 py-2.5 text-center transition-colors border-b-2 ${
                    activeResultTab === 'attributes'
                      ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Atributos Retornados ({result.attributes.length})
                </button>
                <button
                  onClick={() => setActiveResultTab('raw')}
                  className={`flex-1 py-2.5 text-center transition-colors border-b-2 ${
                    activeResultTab === 'raw'
                      ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Saída Técnica do Processo
                </button>
              </div>

              <div className="p-4">
                {activeResultTab === 'attributes' ? (
                  result.attributes.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      Nenhum atributo adicional retornado no pacote de resposta.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto font-mono text-xs">
                      {result.attributes.map((a, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800"
                        >
                          <span className="text-blue-400">{a.name}</span>
                          <span className="text-slate-200 font-semibold">{a.value}</span>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-end">
                      <button
                        onClick={() => copyToClipboard(result.stdout || result.stderr)}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedRaw ? 'Copiado!' : 'Copiar Saída'}
                      </button>
                    </div>

                    <pre className="p-3 bg-slate-950 rounded-lg text-xs font-mono text-slate-300 max-h-64 overflow-y-auto whitespace-pre-wrap">
                      {result.stdout && (
                        <div>
                          <strong className="text-emerald-400">[stdout]</strong>
                          {'\n'}
                          {result.stdout}
                        </div>
                      )}
                      {result.stderr && (
                        <div className="mt-2 text-rose-400">
                          <strong>[stderr]</strong>
                          {'\n'}
                          {result.stderr}
                        </div>
                      )}
                      {!result.stdout && !result.stderr && '// Sem saída capturada'}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Disruptive Packets */}
      <ConfirmModal
        isOpen={disruptiveModalOpen}
        isDestructive={true}
        title="Confirmar Envio Disruptivo (CoA / Disconnect)"
        message={`O pacote '${meta.label}' pode alterar ou derrubar sessões ativas no NAS/BRAS '${selectedServer?.name}' (${selectedServer?.host}). Tem certeza absoluta que deseja enviar este pacote agora?`}
        confirmText="Confirmar e Enviar"
        cancelText="Cancelar"
        onConfirm={() => executeSend(true)}
        onCancel={() => setDisruptiveModalOpen(false)}
      />

      {/* Modal: Save as Template */}
      {saveTemplateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Salvar como Modelo</h3>
            <p className="text-xs text-slate-400 mt-1">
              Salve a lista atual de atributos para reutilizar rapidamente em testes futuros.
            </p>

            <form onSubmit={handleSaveTemplate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nome do Modelo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: PPPoE Início de Sessão 200M"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Descrição (opcional)</label>
                <textarea
                  placeholder="Ex: Utilizado para validar contabilização da OLT da região central"
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSaveTemplateOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Salvar Modelo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
