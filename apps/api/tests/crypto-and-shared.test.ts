import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '../src/lib/crypto';
import {
  PacketType,
  validateAcctStatusConsistency,
  formatAttributesForRadclient,
  radiusAttributeSchema,
} from '@radius-web/shared';

describe('crypto service', () => {
  const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('encrypts and decrypts secret correctly with AES-256-GCM', () => {
    const secret = 'super-secret-radius-shared-key-2026!';
    const cipherText = encryptSecret(secret, testKey);

    expect(cipherText).not.toBe(secret);
    expect(cipherText.split(':').length).toBe(3);

    const decrypted = decryptSecret(cipherText, testKey);
    expect(decrypted).toBe(secret);
  });

  it('throws error when decrypting with tampered data', () => {
    const secret = 'test-secret';
    const cipherText = encryptSecret(secret, testKey);
    const parts = cipherText.split(':');
    parts[2] = '00' + parts[2].substring(2); // tamper encrypted bytes

    expect(() => decryptSecret(parts.join(':'), testKey)).toThrow();
  });
});

describe('validation and formatting', () => {
  it('enforces Acct-Status-Type = Start for Accounting-Start', () => {
    const valid = validateAcctStatusConsistency(PacketType.ACCOUNTING_START, [
      { name: 'Acct-Status-Type', value: 'Start' },
    ]);
    expect(valid.valid).toBe(true);

    const invalid = validateAcctStatusConsistency(PacketType.ACCOUNTING_START, [
      { name: 'Acct-Status-Type', value: 'Stop' },
    ]);
    expect(invalid.valid).toBe(false);
  });

  it('enforces Acct-Status-Type = Stop for Accounting-Stop', () => {
    const valid = validateAcctStatusConsistency(PacketType.ACCOUNTING_STOP, [
      { name: 'Acct-Status-Type', value: 'Stop' },
    ]);
    expect(valid.valid).toBe(true);

    const missing = validateAcctStatusConsistency(PacketType.ACCOUNTING_STOP, [
      { name: 'User-Name', value: 'cliente' },
    ]);
    expect(missing.valid).toBe(false);
  });

  it('rejects CRLF injection in attribute values', () => {
    const injection = radiusAttributeSchema.safeParse({
      name: 'User-Name',
      value: 'admin\nFramed-IP-Address = 1.1.1.1',
    });
    expect(injection.success).toBe(false);
  });

  it('formats attributes for radclient stdin and masks sensitive fields when requested', () => {
    const attrs = [
      { name: 'User-Name', value: 'joao' },
      { name: 'User-Password', value: 'segredo123', isSensitive: true },
      { name: 'Calling-Station-Id', value: 'AA:BB:CC:DD' },
    ];

    const rawFormatted = formatAttributesForRadclient(attrs, { redactSensitive: false });
    expect(rawFormatted).toContain('User-Password = segredo123');

    const redactedFormatted = formatAttributesForRadclient(attrs, { redactSensitive: true });
    expect(redactedFormatted).toContain('User-Password = ***REDACTED***');
    expect(redactedFormatted).not.toContain('segredo123');
  });
});
