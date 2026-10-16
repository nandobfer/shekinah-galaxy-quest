import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ParticlesPluginRegistrar } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import { LoginParticleBackground } from '../login-particle-background';

const state = vi.hoisted(() => ({ reduced: false, options: {} as Record<string, unknown>, register: undefined as ParticlesPluginRegistrar | undefined }));
vi.mock('framer-motion', async importOriginal => ({ ...await importOriginal<typeof import('framer-motion')>(), useReducedMotion: () => state.reduced }));
vi.mock('@tsparticles/slim', () => ({ loadSlim: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tsparticles/react', () => ({
  ParticlesProvider: ({ children, init }: { children: ReactNode; init: ParticlesPluginRegistrar }) => { state.register = init; return children; },
  default: ({ options, id }: { options: Record<string, unknown>; id: string }) => { state.options = options; return <div id={id} data-testid="particles" />; },
}));
beforeEach(() => {
  state.reduced = false; state.options = {}; state.register = undefined;
  document.documentElement.style.setProperty('--primary', '270 100% 50%');
  vi.clearAllMocks();
});

describe('fundo de partículas do Opex adaptado', () => {
  it('usa os tokens e preserva a receita links sem camada negativa', async () => {
    const { container } = render(<LoginParticleBackground />);
    expect(screen.getByTestId('particles').id).toBe('shekinah-login-particles');
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(state.options).toMatchObject({
      fullScreen: { enable: false }, fpsLimit: 60, pauseOnBlur: true, pauseOnOutsideViewport: true,
      particles: { color: { value: 'hsl(270 100% 50%)' }, links: { enable: true, distance: 150, opacity: 0.5 }, number: { value: 90 }, move: { enable: true, speed: 1.6 } },
    });
    const engine = {} as Parameters<ParticlesPluginRegistrar>[0];
    await state.register?.(engine);
    expect(loadSlim).toHaveBeenCalledWith(engine);
  });
  it('mantém partículas estáticas e desliga interações com movimento reduzido', () => {
    state.reduced = true;
    render(<LoginParticleBackground />);
    expect(state.options).toMatchObject({ particles: { move: { enable: false } }, interactivity: { events: { onHover: { enable: false }, onClick: { enable: false } } } });
  });
  it('não inicializa canvas se o tema não estiver disponível', () => {
    document.documentElement.style.removeProperty('--primary');
    render(<LoginParticleBackground />);
    expect(screen.queryByTestId('particles')).toBeNull();
  });
});
