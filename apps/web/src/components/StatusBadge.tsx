import React from 'react';
import { ExecutionStatus } from '@radius-web/shared';
import { CheckCircle2, XCircle, AlertTriangle, AlertOctagon, HelpCircle } from 'lucide-react';

interface Props {
  status: string;
  responseCode?: string | null;
}

export const StatusBadge: React.FC<Props> = ({ status, responseCode }) => {
  switch (status) {
    case ExecutionStatus.RESPONSE_RECEIVED:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {responseCode || 'Sucesso'}
        </span>
      );
    case ExecutionStatus.REJECTED:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
          <XCircle className="w-3.5 h-3.5" />
          {responseCode || 'Rejeitado'}
        </span>
      );
    case ExecutionStatus.TIMEOUT:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5" />
          Timeout
        </span>
      );
    case ExecutionStatus.EXECUTION_ERROR:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <AlertOctagon className="w-3.5 h-3.5" />
          Erro Local
        </span>
      );
    case ExecutionStatus.INVALID_RESPONSE:
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
          <HelpCircle className="w-3.5 h-3.5" />
          {responseCode || 'Não Reconhecido'}
        </span>
      );
  }
};
