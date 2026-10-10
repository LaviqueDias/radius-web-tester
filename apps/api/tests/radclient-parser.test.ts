import { describe, it, expect } from 'vitest';
import { parseRadclientOutput } from '../src/modules/execution/radclient-parser';
import { ExecutionStatus, PacketType } from '@radius-web/shared';

describe('radclient-parser', () => {
  it('classifies Access-Accept (code 2) as response_received', () => {
    const stdout = `
Received response ID 1, code 2, length 20
	Framed-IP-Address = 10.50.0.10
	Reply-Message = "Bem-vindo"
    `;
    const result = parseRadclientOutput(PacketType.ACCESS_REQUEST, stdout, '', 0);

    expect(result.status).toBe(ExecutionStatus.RESPONSE_RECEIVED);
    expect(result.responseCode).toBe('Access-Accept');
    expect(result.attributes).toEqual([
      { name: 'Framed-IP-Address', value: '10.50.0.10' },
      { name: 'Reply-Message', value: 'Bem-vindo' },
    ]);
  });

  it('classifies Access-Reject (code 3) as rejected', () => {
    const stdout = `
Received response ID 42, code 3, length 20
	Reply-Message = "Senha incorreta"
    `;
    const result = parseRadclientOutput(PacketType.ACCESS_REQUEST, stdout, '', 0);

    expect(result.status).toBe(ExecutionStatus.REJECTED);
    expect(result.responseCode).toBe('Access-Reject');
    expect(result.attributes).toEqual([{ name: 'Reply-Message', value: 'Senha incorreta' }]);
  });

  it('classifies Accounting-Response (code 5) as response_received', () => {
    const stdout = `
Received response ID 2, code 5, length 20
    `;
    const result = parseRadclientOutput(PacketType.ACCOUNTING_START, stdout, '', 0);

    expect(result.status).toBe(ExecutionStatus.RESPONSE_RECEIVED);
    expect(result.responseCode).toBe('Accounting-Response');
  });

  it('classifies radclient timeout message as timeout', () => {
    const stderr = `radclient: no response from server for ID 0 socket 3`;
    const result = parseRadclientOutput(PacketType.ACCOUNTING_START, '', stderr, 1, false);

    expect(result.status).toBe(ExecutionStatus.TIMEOUT);
    expect(result.responseCode).toBeNull();
  });

  it('classifies hard timeout as timeout', () => {
    const result = parseRadclientOutput(PacketType.ACCESS_REQUEST, '', '', null, true);

    expect(result.status).toBe(ExecutionStatus.TIMEOUT);
  });

  it('detects invalid authenticator due to secret mismatch', () => {
    const stderr = `radclient: received response with invalid authenticator!`;
    const result = parseRadclientOutput(PacketType.ACCESS_REQUEST, '', stderr, 0);

    expect(result.status).toBe(ExecutionStatus.INVALID_RESPONSE);
    expect(result.responseCode).toBe('Invalid-Authenticator');
  });

  it('handles execution error with non-zero exit code', () => {
    const stderr = `radclient: Failed to find IP address for host non-existent-host.local`;
    const result = parseRadclientOutput(PacketType.ACCESS_REQUEST, '', stderr, 1);

    expect(result.status).toBe(ExecutionStatus.EXECUTION_ERROR);
    expect(result.summary).toContain('Failed to find IP address');
  });
});
