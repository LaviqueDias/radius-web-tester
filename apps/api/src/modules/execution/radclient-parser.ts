import { ExecutionStatus, PacketType } from '@radius-web/shared';

export interface ParsedRadiusResult {
  status: ExecutionStatus;
  responseCode: string | null;
  attributes: Array<{ name: string; value: string }>;
  summary: string;
}

const RADIUS_CODE_MAP: Record<number, string> = {
  1: 'Access-Request',
  2: 'Access-Accept',
  3: 'Access-Reject',
  4: 'Accounting-Request',
  5: 'Accounting-Response',
  11: 'Access-Challenge',
  40: 'Disconnect-Request',
  41: 'Disconnect-ACK',
  42: 'Disconnect-NAK',
  43: 'CoA-Request',
  44: 'CoA-ACK',
  45: 'CoA-NAK',
};

/**
 * Parses radclient stdout & stderr to determine execution status, response code, and returned attributes.
 */
export function parseRadclientOutput(
  packetType: PacketType,
  stdout: string,
  stderr: string,
  exitCode: number | null,
  isTimedOut: boolean = false
): ParsedRadiusResult {
  const combined = `${stdout}\n${stderr}`.trim();

  // 1. Check for timeout
  if (
    isTimedOut ||
    /no response from server/i.test(combined) ||
    /timed out/i.test(combined) ||
    /radclient:.*timeout/i.test(combined)
  ) {
    return {
      status: ExecutionStatus.TIMEOUT,
      responseCode: null,
      attributes: [],
      summary: 'Tempo limite esgotado: o servidor RADIUS não respondeu no prazo configurado.',
    };
  }

  // 2. Check for invalid authenticator (bad shared secret)
  if (/invalid authenticator/i.test(combined)) {
    return {
      status: ExecutionStatus.INVALID_RESPONSE,
      responseCode: 'Invalid-Authenticator',
      attributes: [],
      summary: 'Resposta recebida, mas o autenticador é inválido (shared secret incorreto entre cliente e servidor).',
    };
  }

  // 3. Extract RADIUS response code
  let detectedCodeName: string | null = null;

  // Pattern A: "code 2" or "code 3" or "code 5"
  const codeNumberMatch = combined.match(/code\s+(\d+)/i);
  if (codeNumberMatch) {
    const codeNum = parseInt(codeNumberMatch[1], 10);
    if (RADIUS_CODE_MAP[codeNum]) {
      detectedCodeName = RADIUS_CODE_MAP[codeNum];
    }
  }

  // Pattern B: "Received Access-Accept" or "Received Accounting-Response" or "Packet-Type = Access-Accept"
  if (!detectedCodeName) {
    const directNamedMatch = combined.match(
      /(?:Received|Packet-Type\s*=)\s+([A-Za-z0-9\-]+(?:-Accept|-Reject|-Response|-Challenge|-ACK|-NAK))/i
    );
    if (directNamedMatch) {
      detectedCodeName = directNamedMatch[1];
    }
  }

  // 4. Parse returned attributes from stdout
  // When radclient runs in debug mode (-x), stdout contains both sent and received packets.
  // We must isolate the attributes that belong to the received packet block.
  const parsedAttributes: Array<{ name: string; value: string }> = [];
  const lines = stdout.split('\n');

  // Find the last "Received" packet header in stdout
  let receivedIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^Received\b/i.test(lines[i].trim())) {
      receivedIndex = i;
      break;
    }
  }

  // If a "Received" block was found, parse lines after it until the next section
  // If no "Received" line exists and also no "Sent" line exists (e.g. simple test mock), fallback to parsing all lines
  let linesToParse: string[] = [];
  if (receivedIndex >= 0) {
    for (let i = receivedIndex + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      // Stop if another packet header or summary begins
      if (/^(?:Sent|Received|Packet summary)\b/i.test(trimmed)) {
        break;
      }
      linesToParse.push(lines[i]);
    }
  } else if (!lines.some((l) => /^Sent\b/i.test(l.trim()))) {
    linesToParse = lines;
  }

  for (const rawLine of linesToParse) {
    const line = rawLine.trim();
    // Attribute lines match "Attribute-Name = value" or "Attribute-Name := value"
    const attrMatch = line.match(/^([A-Za-z0-9_\-\.]+)\s*(?:=|:=|\+=)\s*(.+)$/);
    if (attrMatch) {
      const name = attrMatch[1];
      let value = attrMatch[2].trim();
      // Unquote if quoted
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.substring(1, value.length - 1);
      }
      parsedAttributes.push({ name, value });
    }
  }

  // 5. Classify by detected code
  if (detectedCodeName) {
    const upper = detectedCodeName.toUpperCase();

    if (upper.includes('ACCEPT') || upper.includes('RESPONSE') || upper.includes('ACK')) {
      return {
        status: ExecutionStatus.RESPONSE_RECEIVED,
        responseCode: detectedCodeName,
        attributes: parsedAttributes,
        summary: `Resposta válida recebida: ${detectedCodeName}.`,
      };
    }

    if (upper.includes('REJECT') || upper.includes('NAK')) {
      return {
        status: ExecutionStatus.REJECTED,
        responseCode: detectedCodeName,
        attributes: parsedAttributes,
        summary: `Rejeição recebida do servidor: ${detectedCodeName}.`,
      };
    }

    if (upper.includes('CHALLENGE')) {
      return {
        status: ExecutionStatus.RESPONSE_RECEIVED,
        responseCode: detectedCodeName,
        attributes: parsedAttributes,
        summary: `Desafio de autenticação recebido: ${detectedCodeName}.`,
      };
    }

    return {
      status: ExecutionStatus.RESPONSE_RECEIVED,
      responseCode: detectedCodeName,
      attributes: parsedAttributes,
      summary: `Resposta RADIUS recebida: ${detectedCodeName}.`,
    };
  }

  // 6. If exitCode !== 0 or there are error messages
  if (exitCode !== 0 || combined.toLowerCase().includes('error:') || combined.toLowerCase().includes('failed')) {
    return {
      status: ExecutionStatus.EXECUTION_ERROR,
      responseCode: null,
      attributes: [],
      summary: stderr.trim() || stdout.trim() || `Falha na execução do processo radclient (código de saída: ${exitCode}).`,
    };
  }

  // 7. If output exists but no RADIUS response could be classified
  if (combined.length > 0) {
    return {
      status: ExecutionStatus.INVALID_RESPONSE,
      responseCode: null,
      attributes: parsedAttributes,
      summary: 'O processo finalizou, mas a saída não pôde ser classificada como uma resposta RADIUS padrão.',
    };
  }

  return {
    status: ExecutionStatus.INVALID_RESPONSE,
    responseCode: null,
    attributes: [],
    summary: 'Nenhuma saída recebida do executor.',
  };
}
