import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  ExecutionStatus,
  PacketType,
  RadclientMode,
  RadiusAttribute,
  formatAttributesForRadclient,
} from '@radius-web/shared';
import { parseRadclientOutput, ParsedRadiusResult } from './radclient-parser';

export interface ExecuteOptions {
  host: string;
  port: number;
  mode: RadclientMode;
  sharedSecret: string;
  packetType: PacketType;
  attributes: RadiusAttribute[];
  timeoutSeconds?: number;
  retries?: number;
}

export interface ExecutionResult extends ParsedRadiusResult {
  durationMs: number;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

// Semaphore to control concurrent radclient executions
class ConcurrencySemaphore {
  private current = 0;
  private max: number;

  constructor(max: number) {
    this.max = max;
  }

  async acquire(): Promise<() => void> {
    while (this.current >= this.max) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this.current++;
    let released = false;
    return () => {
      if (!released) {
        this.current--;
        released = true;
      }
    };
  }

  getCurrent(): number {
    return this.current;
  }
}

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '5', 10);
const MAX_OUTPUT_SIZE = parseInt(process.env.MAX_OUTPUT_SIZE_BYTES || '65536', 10);
const DEFAULT_TIMEOUT = parseInt(process.env.EXECUTION_TIMEOUT_SECONDS || '10', 10);

const semaphore = new ConcurrencySemaphore(MAX_CONCURRENT);

/**
 * Sanitizes output string by removing passwords/secrets if present and capping size
 */
export function sanitizeOutput(output: string, secret?: string): string {
  let sanitized = output;
  if (secret && secret.length >= 3) {
    sanitized = sanitized.replaceAll(secret, '***REDACTED_SECRET***');
  }
  // Redact User-Password values if present in plaintext in output
  sanitized = sanitized.replace(/(User-Password\s*=\s*)(["']?[^"'\n]+["']?)/gi, '$1"***REDACTED***"');

  if (sanitized.length > MAX_OUTPUT_SIZE) {
    sanitized =
      sanitized.slice(0, MAX_OUTPUT_SIZE) +
      `\n... [TRUNCADO: a saída excedeu o limite máximo de ${MAX_OUTPUT_SIZE} bytes]`;
  }
  return sanitized;
}

/**
 * Executes radclient safely without shell
 */
export async function executeRadclient(options: ExecuteOptions): Promise<ExecutionResult> {
  const releaseSemaphore = await semaphore.acquire();
  const startTime = Date.now();

  let tempDir: string | null = null;
  let secretFilePath: string | null = null;

  try {
    // 1. Create secure temporary directory and secret file with restricted permissions (0600)
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-sec-'));
    secretFilePath = path.join(tempDir, 'secret.txt');
    await fs.writeFile(secretFilePath, options.sharedSecret, { mode: 0o600, encoding: 'utf8' });

    // 2. Prepare destination and mode arguments
    const destination = `${options.host}:${options.port}`;
    const timeout = Math.min(Math.max(options.timeoutSeconds || 3, 1), 30);
    const retries = Math.min(Math.max(options.retries ?? 2, 0), 5);
    const binaryPath = process.env.RADCLIENT_PATH || 'radclient';

    // Arguments: radclient -r <retries> -t <timeout> -S <secretFile> <host:port> <mode>
    const args = [
      '-r',
      String(retries),
      '-t',
      String(timeout),
      '-S',
      secretFilePath,
      destination,
      options.mode,
    ];

    // Format attributes for stdin
    const stdinPayload = formatAttributesForRadclient(options.attributes, { redactSensitive: false });

    // 3. Spawn process safely (shell: false)
    const result = await new Promise<{
      stdout: string;
      stderr: string;
      exitCode: number | null;
      isTimedOut: boolean;
    }>((resolve) => {
      let stdoutAcc = '';
      let stderrAcc = '';
      let isTimedOut = false;
      let isSettled = false;

      // Hard timeout for overall process (timeout + 2 extra seconds for process overhead)
      const hardTimeoutMs = (timeout * (retries + 1) + 2) * 1000;
      const timer = setTimeout(() => {
        isTimedOut = true;
        try {
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!child.killed) child.kill('SIGKILL');
          }, 1500);
        } catch {
          // Process might already be dead
        }
      }, hardTimeoutMs);

      let child: ReturnType<typeof spawn>;
      try {
        child = spawn(binaryPath, args, {
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (err: any) {
        clearTimeout(timer);
        return resolve({
          stdout: '',
          stderr: `Erro ao iniciar executável radclient (${binaryPath}): ${err?.message || err}`,
          exitCode: -1,
          isTimedOut: false,
        });
      }

      child.on('error', (err: any) => {
        clearTimeout(timer);
        if (!isSettled) {
          isSettled = true;
          let msg = `Falha ao executar radclient: ${err.message}`;
          if (err.code === 'ENOENT') {
            msg = `Binário do radclient não encontrado no caminho '${binaryPath}'. Verifique se o pacote freeradius-utils está instalado ou configure RADCLIENT_PATH.`;
          }
          resolve({
            stdout: stdoutAcc,
            stderr: msg,
            exitCode: -1,
            isTimedOut: false,
          });
        }
      });

      if (child.stdout) {
        child.stdout.on('data', (chunk) => {
          if (stdoutAcc.length < MAX_OUTPUT_SIZE) {
            stdoutAcc += chunk.toString('utf8');
          }
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (chunk) => {
          if (stderrAcc.length < MAX_OUTPUT_SIZE) {
            stderrAcc += chunk.toString('utf8');
          }
        });
      }

      child.on('close', (code) => {
        clearTimeout(timer);
        if (!isSettled) {
          isSettled = true;
          resolve({
            stdout: stdoutAcc,
            stderr: stderrAcc,
            exitCode: code,
            isTimedOut,
          });
        }
      });

      // Write attributes to stdin and close stream
      if (child.stdin) {
        child.stdin.write(stdinPayload);
        child.stdin.end();
      }
    });

    const durationMs = Date.now() - startTime;
    const sanitizedStdout = sanitizeOutput(result.stdout, options.sharedSecret);
    const sanitizedStderr = sanitizeOutput(result.stderr, options.sharedSecret);

    const parsed = parseRadclientOutput(
      options.packetType,
      sanitizedStdout,
      sanitizedStderr,
      result.exitCode,
      result.isTimedOut
    );

    return {
      ...parsed,
      durationMs,
      exitCode: result.exitCode,
      stdout: sanitizedStdout,
      stderr: sanitizedStderr,
    };
  } finally {
    // 4. Guaranteed cleanup of temporary secret file
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore deletion errors during cleanup
      }
    }
    releaseSemaphore();
  }
}
