import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regressão da publicação web nos Composes: a interface precisa escutar em `0.0.0.0`
 * (todas as interfaces IPv4) e a porta publicada precisa vir de `PORT`, com `ADMIN_PORT`
 * como fallback. Assim a prévia é acessível pelo IP do servidor e a faixa reservada
 * (7001–7098) prevalece sobre qualquer `ADMIN_PORT` herdado.
 */
const ROOT = process.cwd();
const COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.dev.yml'];

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

/** Recorta o bloco YAML de um serviço (linhas indentadas sob `  <serviço>:`). */
function readServiceBlock(compose: string, service: string): string {
  const lines = compose.split('\n');
  const start = lines.findIndex(line => line.startsWith(`  ${service}:`));
  expect(start, `${service} ausente no Compose`).toBeGreaterThanOrEqual(0);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(line => /^ {2}\S/.test(line) || /^\S/.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

/** Separa o mapeamento em host, porta publicada e porta interna, ignorando os `:` dentro de `${...}`. */
function splitMapping(value: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of value) {
    if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    if (char === ':' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

/** Extrai host, porta publicada e porta interna do único mapeamento `ports:` do arquivo. */
function readPublishedPort(relativePath: string): { host: string; published: string; container: string } {
  const matches = [...readRepoFile(relativePath).matchAll(/^\s*ports:\s*\["([^"]+)"\]\s*$/gm)];
  expect(matches, `${relativePath}: esperado exatamente um mapeamento de porta`).toHaveLength(1);
  const parts = splitMapping(matches[0]?.[1] ?? '');
  expect(parts, `${relativePath}: mapeamento de porta não reconhecido`).toHaveLength(3);
  return { host: parts[0] as string, published: parts[1] as string, container: parts[2] as string };
}

/** Avalia a expressão do Compose com defaults aninhados, do mais interno para o mais externo. */
function resolveComposePort(expression: string, env: Record<string, string | undefined> = {}): string {
  const innermost = /\$\{([A-Z0-9_]+):-([^{}]*)\}/;
  let resolved = expression;
  let match = innermost.exec(resolved);
  for (let guard = 0; match && guard < 10; guard += 1) {
    resolved = resolved.replace(match[0], env[match[1] as string] ?? (match[2] as string));
    match = innermost.exec(resolved);
  }
  expect(resolved, `expressão não resolvida: ${expression}`).not.toContain('${');
  return resolved;
}

describe.each(COMPOSE_FILES)('publicação web em %s', file => {
  const { host, published, container } = readPublishedPort(file);

  it('escuta em todas as interfaces IPv4', () => {
    expect(host).toBe('0.0.0.0');
    expect(readRepoFile(file)).not.toContain('127.0.0.1:');
  });

  it('publica a porta de PORT, com ADMIN_PORT como fallback', () => {
    expect(published).toBe('${PORT:-${ADMIN_PORT:-5180}}');
    expect(resolveComposePort(published, { PORT: '7001' })).toBe('7001');
    expect(resolveComposePort(published, { PORT: '7001', ADMIN_PORT: '4009' })).toBe('7001');
    expect(resolveComposePort(published, { ADMIN_PORT: '4009' })).toBe('4009');
    expect(resolveComposePort(published)).toBe('5180');
  });

  it('aponta a porta interna para o que o serviço web escuta', () => {
    // No admin estático é a porta 80 do Nginx; no desenvolvimento é a porta do Vite.
    expect(container === '80' || container === published).toBe(true);
  });

  it('não publica a porta da API', () => {
    const compose = readRepoFile(file);
    expect([...compose.matchAll(/^\s*ports:/gm)]).toHaveLength(1);
    expect(readServiceBlock(compose, 'api')).not.toContain('ports:');
    expect(readServiceBlock(compose, 'admin')).toContain('ports:');
  });
});

describe('servidor de desenvolvimento do admin', () => {
  const viteConfig = readRepoFile('apps/admin/vite.config.ts');

  it('escuta em 0.0.0.0', () => {
    expect(viteConfig).toMatch(/host:\s*'0\.0\.0\.0'/);
  });

  it('usa a mesma precedência de porta do Compose', () => {
    expect(viteConfig).toMatch(/port:\s*Number\(env\.PORT \|\| env\.ADMIN_PORT \|\| 5180\)/);
  });
});
