import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ParticlesPluginRegistrar } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import { loadManualParticlesPlugin } from '@tsparticles/plugin-manual-particles';
import { LoginParticleBackground } from '../login-particle-background';
import { generateGalaxy } from '../login-galaxy';

interface ManualParticle {
  position: { x: number; y: number; mode: string };
  options: { color: { value: string }; opacity: { value: number }; size: { value: number } };
}

interface CapturedOptions {
  fpsLimit?: number;
  detectRetina?: boolean;
  pauseOnBlur?: boolean;
  pauseOnOutsideViewport?: boolean;
  interactivity?: { events?: { onHover?: { enable?: boolean }; onClick?: { enable?: boolean } } };
  particles?: {
    number?: { value?: number };
    color?: { value?: readonly string[] };
    links?: { enable?: boolean };
    move?: { enable?: boolean };
    opacity?: { animation?: { enable?: boolean; startValue?: string } };
    shape?: { type?: string };
  };
  manualParticles?: ManualParticle[];
}

const state = vi.hoisted(() => ({
  reduced: false,
  options: {} as CapturedOptions,
  register: undefined as ParticlesPluginRegistrar | undefined,
  animate: undefined as Record<string, unknown> | undefined,
}));

vi.mock('framer-motion', async importOriginal => ({
  ...(await importOriginal<typeof import('framer-motion')>()),
  useReducedMotion: () => state.reduced,
  motion: {
    div: (props: { animate?: Record<string, unknown>; children?: ReactNode }) => {
      state.animate = props.animate;
      return <div className="motion-stub">{props.children}</div>;
    },
  },
}));
vi.mock('@tsparticles/slim', () => ({ loadSlim: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tsparticles/plugin-manual-particles', () => ({ loadManualParticlesPlugin: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tsparticles/react', () => ({
  ParticlesProvider: ({ children, init }: { children: ReactNode; init: ParticlesPluginRegistrar }) => {
    state.register = init;
    return children;
  },
  default: ({ options, id }: { options: CapturedOptions; id: string }) => {
    state.options = options;
    return <div id={id} data-testid="particles" />;
  },
}));

const THEME_COLORS = ['hsl(260 20% 96%)', 'hsl(270 100% 64%)', 'hsl(270 100% 50%)'];

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
}

beforeEach(() => {
  state.reduced = false;
  state.options = {};
  state.register = undefined;
  state.animate = undefined;
  setViewport(1024, 768);
  document.documentElement.style.setProperty('--primary', '270 100% 50%');
  document.documentElement.style.setProperty('--ring', '270 100% 64%');
  document.documentElement.style.setProperty('--foreground', '260 20% 96%');
  vi.clearAllMocks();
});

afterEach(() => {
  document.documentElement.style.removeProperty('--primary');
  document.documentElement.style.removeProperty('--ring');
  document.documentElement.style.removeProperty('--foreground');
});

describe('fundo de galáxia do login', () => {
  it('monta a espiral como partículas manuais com as cores do tema e sem ligações', async () => {
    const { container } = render(<LoginParticleBackground />);

    expect(screen.getByTestId('particles').id).toBe('shekinah-login-particles');
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(container.firstElementChild?.className).toContain('pointer-events-none');

    const options = state.options;
    expect(options.manualParticles).toHaveLength(generateGalaxy().length);
    expect(options.particles?.number?.value).toBe(0);
    expect(options.particles?.links?.enable).toBe(false);
    expect(options.particles?.move?.enable).toBe(false);
    expect(options.particles?.shape?.type).toBe('circle');
    expect(options.particles?.color?.value).toEqual(THEME_COLORS);
    expect(options.fpsLimit).toBe(60);
    expect(options.detectRetina).toBe(true);
    expect(options.pauseOnBlur).toBe(true);
    expect(options.pauseOnOutsideViewport).toBe(true);
    expect(options.interactivity?.events?.onHover?.enable).toBe(false);
    expect(options.interactivity?.events?.onClick?.enable).toBe(false);

    for (const particle of options.manualParticles ?? []) {
      expect(particle.position.mode).toBe('percent');
      expect(particle.position.x).toBeGreaterThanOrEqual(0);
      expect(particle.position.x).toBeLessThanOrEqual(100);
      expect(particle.position.y).toBeGreaterThanOrEqual(0);
      expect(particle.position.y).toBeLessThanOrEqual(100);
      expect(particle.options.size.value).toBeGreaterThan(0);
      expect(THEME_COLORS).toContain(particle.options.color.value);
    }

    const engine = {} as Parameters<ParticlesPluginRegistrar>[0];
    await state.register?.(engine);
    expect(loadSlim).toHaveBeenCalledWith(engine);
    expect(loadManualParticlesPlugin).toHaveBeenCalledWith(engine);
  });

  it('gira a galáxia e cintila as estrelas por padrão', () => {
    render(<LoginParticleBackground />);

    expect(state.options.particles?.opacity?.animation?.enable).toBe(true);
    expect(state.animate).toEqual({ rotate: 360 });
    expect(state.options.manualParticles?.length).toBeGreaterThan(0);
  });

  it('deixa a galáxia estática com movimento reduzido', () => {
    state.reduced = true;
    render(<LoginParticleBackground />);

    expect(state.options.particles?.opacity?.animation?.enable).toBe(false);
    expect(state.animate).toBeUndefined();
    // A galáxia continua montada; só não anima.
    expect(screen.getByTestId('particles')).toBeTruthy();
  });

  it('recalcula as posições quando o viewport muda', async () => {
    render(<LoginParticleBackground />);
    const before = state.options.manualParticles?.[0]?.position.x;

    setViewport(600, 900);
    fireEvent(window, new Event('resize'));

    await waitFor(() => expect(state.options.manualParticles?.[0]?.position.x).not.toBe(before));
  });

  it('não monta o canvas quando o tema não está disponível', () => {
    document.documentElement.style.removeProperty('--primary');
    render(<LoginParticleBackground />);

    expect(screen.queryByTestId('particles')).toBeNull();
  });
});
