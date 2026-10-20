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

  it('correctly parses Access-Reject containing Message-Authenticator and Authenticator-Field', () => {
    const stdout = `
Received Access-Reject Id 135 from 172.21.0.2:1812 to 172.21.0.4:39012 length 38
	Message-Authenticator = 0xb4b2996c659099eb8d23040f9e221f4a
	Authenticator-Field = 0x4dd7b2ce9439806f500026335657dd01
    `;
    const stderr = `(0) -: Expected Access-Accept got Access-Reject`;
    const result = parseRadclientOutput(PacketType.ACCESS_REQUEST, stdout, stderr, 1);

    expect(result.status).toBe(ExecutionStatus.REJECTED);
    expect(result.responseCode).toBe('Access-Reject');
    expect(result.attributes).toHaveLength(2);
    expect(result.attributes).toEqual([
      { name: 'Message-Authenticator', value: '0xb4b2996c659099eb8d23040f9e221f4a' },
      { name: 'Authenticator-Field', value: '0x4dd7b2ce9439806f500026335657dd01' },
    ]);
  });

  it('isolates received attributes from sent attributes when radclient runs in debug mode (-x)', () => {
    const stdout = `
Sent Access-Request Id 134 from 0.0.0.0:40857 to 172.21.0.2:1812 length 109
	User-Name = "teste@provedor.com.br"
	User-Password = "***REDACTED***"
	NAS-IP-Address = 192.168.1.1
	NAS-Port = 0
	NAS-Port-Type = Ethernet
	Service-Type = Framed-User
	Framed-Protocol = PPP
	Cleartext-Password = "***REDACTED***"
Received Access-Reject Id 134 from 172.21.0.2:1812 to 172.21.0.4:40857 length 38
	Message-Authenticator = 0x870882b7a0e3b83b63efe18ac6e5a0ef
    `;
    const stderr = `(0) -: Expected Access-Accept got Access-Reject`;
    const result = parseRadclientOutput(PacketType.ACCESS_REQUEST, stdout, stderr, 1);

    expect(result.status).toBe(ExecutionStatus.REJECTED);
    expect(result.responseCode).toBe('Access-Reject');
    // Ensure sent attributes are not included in returned attributes
    expect(result.attributes).toEqual([
      { name: 'Message-Authenticator', value: '0x870882b7a0e3b83b63efe18ac6e5a0ef' },
    ]);
    expect(result.attributes).toHaveLength(1);
    expect(result.attributes.some((a) => a.name === 'User-Name')).toBe(false);
  });

  it('correctly parses Access-Accept with radclient -x debug output', () => {
    const stdout = `
Sent Access-Request Id 58 from 0.0.0.0:44591 to 172.21.0.2:1812 length 63
	User-Name = "teste"
	User-Password = "***REDACTED***"
	Cleartext-Password = "***REDACTED***"
Received Access-Accept Id 58 from 172.21.0.2:1812 to 172.21.0.4:44591 length 58
	Message-Authenticator = 0x0cb700079bcebc3c7c82a48245bbed7b
	Framed-IP-Address = 10.10.10.10
	Reply-Message = "Welcome User"
    `;
    const result = parseRadclientOutput(PacketType.ACCESS_REQUEST, stdout, '', 0);

    expect(result.status).toBe(ExecutionStatus.RESPONSE_RECEIVED);
    expect(result.responseCode).toBe('Access-Accept');
    expect(result.attributes).toEqual([
      { name: 'Message-Authenticator', value: '0x0cb700079bcebc3c7c82a48245bbed7b' },
      { name: 'Framed-IP-Address', value: '10.10.10.10' },
      { name: 'Reply-Message', value: 'Welcome User' },
    ]);
    expect(result.attributes).toHaveLength(3);
  });

  it('classifies Access-Challenge and extracts challenge attributes', () => {
    const stdout = `
Sent Access-Request Id 99 from 0.0.0.0:44591 to 172.21.0.2:1812 length 63
	User-Name = "usuario-mfa"
Received Access-Challenge Id 99 from 172.21.0.2:1812 to 172.21.0.4:44591 length 40
	Reply-Message = "Digite o token OTP"
	State = 0x6e657874
    `;
    const result = parseRadclientOutput(PacketType.ACCESS_REQUEST, stdout, '', 0);

    expect(result.status).toBe(ExecutionStatus.RESPONSE_RECEIVED);
    expect(result.responseCode).toBe('Access-Challenge');
    expect(result.attributes).toEqual([
      { name: 'Reply-Message', value: 'Digite o token OTP' },
      { name: 'State', value: '0x6e657874' },
    ]);
  });
});
