import { Injectable } from '@nestjs/common';
import Pusher from 'pusher';
import nodemailer from 'nodemailer';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { z } from 'zod';
import type { IntegrationId, PublicValue } from '@shekinah/contracts';

export const CHECK_TIMEOUT_MS = 10_000;
export class CheckFailure extends Error {}
/** Read-only probes. Never log SDK exceptions, response bodies or signed URLs. */
@Injectable()
export class ConnectionChecker {
  async check(id: IntegrationId, values: Record<string, PublicValue>, secrets: Record<string, string>, signal: AbortSignal): Promise<string> {
    const text = (key: string) => String(values[key] ?? '');
    if (id === 'pusher') {
      const host = values.mode === 'host' ? new URL(text('url')) : null;
      const client = new Pusher({ appId: text('appId'), key: text('key'), secret: secrets.secret!, timeout: CHECK_TIMEOUT_MS,
        ...(host ? { host: host.hostname, port: host.port || (host.protocol === 'https:' ? '443' : '80'), useTLS: host.protocol === 'https:' } : { cluster: text('cluster'), useTLS: true }),
      });
      // SDK timeout bounds the request; it does not expose AbortSignal.
      const response = await client.get({ path: '/channels' });
      if (!response.ok) throw new CheckFailure(`Pusher respondeu HTTP ${response.status}.`);
      await response.text();
      return 'Credenciais do Pusher válidas.';
    }
    if (id === 'smtp') {
      const client = nodemailer.createTransport({ host: text('host'), port: Number(values.port), secure: values.port === 465,
        requireTLS: values.port !== 465, auth: text('user') ? { user: text('user'), pass: secrets.password ?? '' } : undefined,
        connectionTimeout: CHECK_TIMEOUT_MS, greetingTimeout: CHECK_TIMEOUT_MS, socketTimeout: CHECK_TIMEOUT_MS,
        dnsTimeout: CHECK_TIMEOUT_MS, logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
      });
      const abort = () => client.close();
      signal.addEventListener('abort', abort, { once: true });
      try { await client.verify(); return 'SMTP aceitou conexão e autenticação. Nenhum e-mail foi enviado.'; }
      finally { signal.removeEventListener('abort', abort); client.close(); }
    }
    if (id === 'storage_s3') {
      const client = new S3Client({ endpoint: text('endpoint'), region: text('region'), forcePathStyle: true, maxAttempts: 1,
        credentials: { accessKeyId: secrets.accessKey!, secretAccessKey: secrets.secretKey! },
        requestHandler: new NodeHttpHandler({ connectionTimeout: CHECK_TIMEOUT_MS, requestTimeout: CHECK_TIMEOUT_MS }),
      });
      try { await client.send(new HeadBucketCommand({ Bucket: text('bucket') }), { abortSignal: signal }); return 'Bucket S3 acessível. Nenhum arquivo foi gravado.'; }
      finally { client.destroy(); }
    }
    if (id === 'ai_gemini') return this.probe('https://generativelanguage.googleapis.com/v1beta/models', { 'x-goog-api-key': secrets.apiKey! }, signal, 'Gemini');
    if (id === 'ai_jev') return this.probe('https://api.typesafe.ai/v1/models', { Authorization: `Bearer ${secrets.apiKey!}` }, signal, 'JEV');
    if (id === 'ai_opencode') return this.probe(`${text('baseUrl').replace(/\/$/, '')}/api/info`, { Authorization: `Basic ${Buffer.from(`opencode:${secrets.password}`).toString('base64')}` }, signal, 'OpenCode');
    throw new CheckFailure('Verificador não disponível.');
  }
  private async probe(url: string, headers: Record<string, string>, signal: AbortSignal, label: string) {
    const response = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal, redirect: 'error' });
    if (!response.ok) { await response.body?.cancel(); throw new CheckFailure(`${label} respondeu HTTP ${response.status}.`); }
    const schema = label === 'OpenCode' ? z.object({ version: z.string().min(1) }) : z.object({ models: z.array(z.unknown()).optional() });
    if (!schema.safeParse(await response.json()).success) throw new CheckFailure(`${label} retornou um contrato incompatível.`);
    return `${label} acessível. Nenhuma geração de IA foi solicitada.`;
  }
}
