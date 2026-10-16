/**
 * Geração determinística das estrelas da galáxia do fundo de login.
 *
 * O bundle `@tsparticles/slim` não distribui partículas em braços espirais por configuração, então
 * as posições são calculadas aqui — fora do React e sem acesso ao DOM — e entregues ao tsParticles
 * como `manualParticles`. O gerador é puro e determinístico: a mesma semente produz sempre a mesma
 * galáxia, o que mantém a cena estável entre renders e verificável em testes.
 *
 * As estrelas vivem em um "disco unitário": cada coordenada varia de -1 a 1 em relação ao centro,
 * independentemente do tamanho da tela. A conversão para percentuais do canvas acontece no
 * componente, que conhece a proporção do viewport.
 */

export interface GalaxyStar {
  /** Posição horizontal no disco unitário (-1 a 1, 0 = centro). */
  x: number;
  /** Posição vertical no disco unitário (-1 a 1, 0 = centro). */
  y: number;
  /** Raio da estrela em pixels. */
  size: number;
  /** Opacidade base (0 a 1) antes da cintilação. */
  opacity: number;
  /** Índice na paleta do tema (0 = núcleo claro, 1 = braços, 2 = periferia). */
  colorIndex: number;
}

export interface GalaxyOptions {
  /** Quantidade total de estrelas. */
  count?: number;
  /** Número de braços espirais. */
  arms?: number;
  /** Quantas voltas completas cada braço descreve até a borda. */
  turns?: number;
  /** Semente do gerador determinístico. */
  seed?: number;
}

/** Quantidade padrão de estrelas da cena. */
const DEFAULT_COUNT = 480;
const DEFAULT_ARMS = 2;
const DEFAULT_TURNS = 1.6;
const DEFAULT_SEED = 1;
/** Fração das estrelas que forma o núcleo denso; o restante segue os braços. */
const CORE_SHARE = 0.34;
/** Raio máximo do núcleo no disco unitário. */
const CORE_RADIUS = 0.28;
/** Expoente do raio ao longo do braço: abaixo de 1 adensa a parte interna da espiral. */
const ARM_RADIAL_EXPONENT = 0.85;

/** Gerador pseudoaleatório mulberry32 — curto e determinístico (mesma semente, mesma cena). */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Aresta suave (smoothstep), usada para esmaecer as estrelas na periferia do disco. */
function smoothstep(edge0: number, edge1: number, value: number): number {
  const ratio = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return ratio * ratio * (3 - 2 * ratio);
}

/** Brilho relativo pela distância ao centro: máximo no núcleo, mínimo na borda. */
function brightnessFor(radius: number): number {
  return 1 - smoothstep(0.12, 1, radius);
}

/** Cor atribuída pelo raio: núcleo claro, braços violeta, periferia mais escura. */
function colorIndexFor(radius: number, random: () => number): number {
  if (radius < CORE_RADIUS * 0.6) return 0;
  if (radius < 0.62) return random() < 0.5 ? 1 : 0;
  return random() < 0.75 ? 2 : 1;
}

function createStar(x: number, y: number, radius: number, random: () => number): GalaxyStar {
  // Normaliza para o disco unitário; evita estrelas fora da área segura à rotação da camada.
  const distance = Math.hypot(x, y);
  const nx = distance > 1 ? x / distance : x;
  const ny = distance > 1 ? y / distance : y;
  const normalizedRadius = clamp(radius, 0, 1);
  const brightness = brightnessFor(normalizedRadius);
  const size = clamp(0.6 + brightness * 1.8 + random() * 0.6, 0.5, 3.2);
  const opacity = clamp(0.18 + brightness * 0.72 + random() * 0.12, 0.12, 1);
  return {
    x: nx,
    y: ny,
    size: round(size),
    opacity: round(opacity),
    colorIndex: colorIndexFor(normalizedRadius, random),
  };
}

/** Gera as estrelas de uma galáxia espiral de braços + núcleo denso, em ordem determinística. */
export function generateGalaxy(options: GalaxyOptions = {}): GalaxyStar[] {
  const count = Math.max(1, Math.floor(options.count ?? DEFAULT_COUNT));
  const arms = Math.max(1, Math.floor(options.arms ?? DEFAULT_ARMS));
  const turns = options.turns ?? DEFAULT_TURNS;
  const random = createRandom(options.seed ?? DEFAULT_SEED);
  const coreCount = Math.round(count * CORE_SHARE);
  const armCount = count - coreCount;
  const armStep = (Math.PI * 2) / arms;
  const armLength = Math.max(1, Math.ceil(armCount / arms));
  const stars: GalaxyStar[] = [];

  for (let index = 0; index < armCount; index += 1) {
    const arm = index % arms;
    const progress = Math.floor(index / arms) / armLength;
    // O jitter de ângulo e raio dá espessura ao braço sem apagar a leitura da espiral.
    const angle = arm * armStep + progress * turns * Math.PI * 2 + (random() - 0.5) * 0.5;
    const radius = clamp(Math.pow(progress, ARM_RADIAL_EXPONENT) + (random() - 0.5) * 0.06, 0.02, 1);
    const spread = 0.02 + radius * 0.09;
    const x = Math.cos(angle) * radius + (random() - 0.5) * spread;
    const y = Math.sin(angle) * radius + (random() - 0.5) * spread;
    stars.push(createStar(x, y, radius, random));
  }

  for (let index = 0; index < coreCount; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = CORE_RADIUS * Math.sqrt(random());
    stars.push(createStar(Math.cos(angle) * radius, Math.sin(angle) * radius, radius, random));
  }

  return stars;
}
