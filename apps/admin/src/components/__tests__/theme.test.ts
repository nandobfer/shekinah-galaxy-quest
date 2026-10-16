import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// Read the theme contract verbatim: jsdom's CSS transform intentionally stubs CSS modules.
const here = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(resolve(here, '../../../../../packages/design-tokens/theme.css'), 'utf8');
const css = readFileSync(resolve(here, '../../styles.css'), 'utf8');
const html = readFileSync(resolve(here, '../../../index.html'), 'utf8');

describe('contrato visual do tema Opex', () => {
  it.each([
    ['background', '260 22% 6%'], ['foreground', '260 20% 96%'], ['primary', '270 100% 50%'],
    ['primary-foreground', '0 0% 100%'], ['muted', '260 16% 14%'], ['muted-foreground', '260 10% 66%'],
    ['card', '260 20% 9%'], ['input', '260 16% 20%'], ['ring', '270 100% 64%'], ['radius', '0.5rem'],
  ])('preserva o token %s da referência', (name, value) => {
    expect(tokens).toContain(`--${name}: ${value};`);
  });
  it('usa HSL, variantes dark por classe e Inter local', () => {
    expect(css).toContain('--color-primary: hsl(var(--primary))');
    expect(css).toContain('@variant dark (&:where(.dark, .dark *))');
    expect(css).toContain("'Inter Variable'");
    expect(html).toContain('class="dark"');
    expect(html).not.toContain('fonts.googleapis.com');
  });
});
