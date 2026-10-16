import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Particles, { ParticlesProvider, type ParticlesPluginRegistrar } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import { loadManualParticlesPlugin } from '@tsparticles/plugin-manual-particles';
import { generateGalaxy, type GalaxyStar } from './login-galaxy';

type ParticlesOptions = NonNullable<ComponentProps<typeof Particles>['options']>;

/** Paleta do tema aplicada à galáxia: 0 = núcleo claro, 1 = braços, 2 = periferia. */
type GalaxyPalette = readonly [string, string, string];

/**
 * Partícula posicionada manualmente. O plugin `@tsparticles/plugin-manual-particles` não reexporta
 * a interface pública, então o formato aceito é descrito aqui (o engine lê estes campos).
 */
interface ManualParticle {
  position: { x: number; y: number; mode: 'percent' };
  options: {
    color: { value: string };
    opacity: { value: number };
    size: { value: number };
    move: { enable: false };
    links: { enable: false };
  };
}

type GalaxyParticlesOptions = ParticlesOptions & { manualParticles: ManualParticle[] };

/** Raio do disco galáctico como fração do menor lado do viewport (< 0.5 para a rotação não cortar). */
const GALAXY_RADIUS_RATIO = 0.47;
/** Duração (s) de uma volta completa da galáxia: lenta o bastante para não competir com o formulário. */
const GALAXY_ROTATION_SECONDS = 150;

/** Registra o bundle "slim" do tsParticles e o plugin de partículas manuais (uma vez; o provider cuida disso). */
const registerPlugins: ParticlesPluginRegistrar = async engine => {
  await loadSlim(engine);
  await loadManualParticlesPlugin(engine);
};

function readCssVariable(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || null;
}

/** Paleta da galáxia lida dos tokens do tema (nada hardcoded); sem `--primary` não há como pintar a cena. */
function readGalaxyPalette(): GalaxyPalette | null {
  const primary = readCssVariable('--primary');
  if (!primary) return null;
  const ring = readCssVariable('--ring') ?? primary;
  const foreground = readCssVariable('--foreground') ?? ring;
  return [`hsl(${foreground})`, `hsl(${ring})`, `hsl(${primary})`];
}

/** Tamanho do viewport, atualizado ao redimensionar; as posições manuais dependem da proporção da tela. */
function useViewportSize(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  }));

  useEffect(() => {
    let frame = 0;
    const commit = () => {
      frame = 0;
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(commit);
    };
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return size;
}

function toManualParticle(star: GalaxyStar, palette: GalaxyPalette, radius: number, width: number, height: number): ManualParticle {
  return {
    position: {
      x: 50 + (star.x * radius * 100) / width,
      y: 50 + (star.y * radius * 100) / height,
      mode: 'percent',
    },
    options: {
      color: { value: palette[star.colorIndex] },
      opacity: { value: star.opacity },
      size: { value: star.size },
      move: { enable: false },
      links: { enable: false },
    },
  };
}

/**
 * Fundo animado da tela de login: uma galáxia espiral de partículas.
 *
 * As estrelas são geradas em braços ao redor de um núcleo claro e entregues ao tsParticles como
 * partículas manuais — o bundle "slim" não distribui braços espirais por configuração. A camada
 * inteira gira devagar (Framer Motion) enquanto cada estrela cintila pela opacidade, mantendo a
 * leitura da espiral. Fica em `z-0` dentro do `main` (que tem `isolate`), acima do fundo e abaixo do
 * cartão (`z-10`), e não captura ponteiros: o formulário continua clicável.
 *
 * Com `prefers-reduced-motion` a galáxia fica parada (sem rotação nem cintilação). Sem os tokens do
 * tema a cena não é montada, e qualquer falha do canvas é contida por `OptionalVisualEffect`.
 */
export function LoginParticleBackground() {
  const reducedMotion = useReducedMotion();
  const { width, height } = useViewportSize();
  const [palette] = useState(readGalaxyPalette);

  const options = useMemo<GalaxyParticlesOptions | null>(() => {
    if (!palette || width <= 0 || height <= 0) return null;
    const radius = Math.min(width, height) * GALAXY_RADIUS_RATIO;
    return {
      fullScreen: { enable: false },
      fpsLimit: 60,
      detectRetina: true,
      pauseOnBlur: true,
      pauseOnOutsideViewport: true,
      interactivity: { events: { onHover: { enable: false }, onClick: { enable: false } } },
      particles: {
        number: { value: 0 },
        color: { value: [...palette] },
        links: { enable: false },
        move: { enable: false },
        opacity: {
          value: { min: 0.12, max: 1 },
          animation: { enable: !reducedMotion, speed: 0.35, sync: false, startValue: 'random' },
        },
        shape: { type: 'circle' },
        size: { value: { min: 0.5, max: 3.2 } },
      },
      manualParticles: generateGalaxy().map(star => toManualParticle(star, palette, radius, width, height)),
    };
  }, [palette, width, height, reducedMotion]);

  if (!options) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 grid place-items-center overflow-hidden" aria-hidden="true">
      <motion.div
        className="h-full w-full"
        animate={reducedMotion ? undefined : { rotate: 360 }}
        transition={reducedMotion ? undefined : { duration: GALAXY_ROTATION_SECONDS, ease: 'linear', repeat: Infinity }}
      >
        <ParticlesProvider init={registerPlugins}>
          <Particles id="shekinah-login-particles" options={options} className="h-full w-full" />
        </ParticlesProvider>
      </motion.div>
    </div>
  );
}
