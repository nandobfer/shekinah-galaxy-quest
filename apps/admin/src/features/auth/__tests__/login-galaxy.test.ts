import { describe, expect, it } from 'vitest';
import { generateGalaxy } from '../login-galaxy';

const PALETTE_SIZE = 3;

/** Desembrulha uma sequência de ângulos (radianos) para medir o giro acumulado da espiral. */
function unwrap(angles: number[]): number[] {
  const result: number[] = [];
  let previous: number | null = null;
  for (const angle of angles) {
    let value = angle;
    if (previous !== null) {
      while (value < previous) value += Math.PI * 2;
    }
    result.push(value);
    previous = result[result.length - 1] ?? null;
  }
  return result;
}

describe('gerador da galáxia', () => {
  it('é determinístico para a mesma semente', () => {
    expect(generateGalaxy()).toEqual(generateGalaxy());
    expect(generateGalaxy({ seed: 7 })).toEqual(generateGalaxy({ seed: 7 }));
  });

  it('muda a distribuição quando a semente muda', () => {
    expect(generateGalaxy({ seed: 1 })).not.toEqual(generateGalaxy({ seed: 2 }));
  });

  it('respeita a quantidade pedida e o padrão', () => {
    expect(generateGalaxy()).toHaveLength(480);
    expect(generateGalaxy({ count: 40 })).toHaveLength(40);
    expect(generateGalaxy({ count: 10, arms: 3 })).toHaveLength(10);
  });

  it('usa o número de braços e de voltas na distribuição', () => {
    expect(generateGalaxy({ arms: 3 })).not.toEqual(generateGalaxy({ arms: 2 }));
    expect(generateGalaxy({ turns: 2 })).not.toEqual(generateGalaxy({ turns: 1 }));
  });

  it('mantém as estrelas no disco unitário e com valores finitos', () => {
    for (const star of generateGalaxy({ count: 500 })) {
      expect(Number.isFinite(star.x)).toBe(true);
      expect(Number.isFinite(star.y)).toBe(true);
      expect(Math.hypot(star.x, star.y)).toBeLessThanOrEqual(1.0001);
    }
  });

  it('distribui as estrelas do núcleo denso até a periferia', () => {
    const stars = generateGalaxy({ count: 400 });
    const radii = stars.map(star => Math.hypot(star.x, star.y));
    expect(Math.min(...radii)).toBeLessThan(0.1);
    expect(Math.max(...radii)).toBeGreaterThan(0.8);
    expect(radii.filter(radius => radius < 0.3).length).toBeGreaterThan(stars.length * 0.25);
  });

  it('descreve braços espirais que avançam em ângulo conforme o raio cresce', () => {
    // Um braço e muitas voltas tornam o giro medível; o corte de raio descarta núcleo e primeiros pontos.
    const stars = generateGalaxy({ arms: 1, turns: 6, count: 60 });
    const armStars = stars.filter(star => Math.hypot(star.x, star.y) > 0.3);
    expect(armStars.length).toBeGreaterThan(20);
    const angles = unwrap(armStars.map(star => Math.atan2(star.y, star.x)));
    for (let index = 1; index < angles.length; index += 1) {
      expect(angles[index]).toBeGreaterThan(angles[index - 1] ?? 0);
    }
    // As voltas restantes devem somar bem mais de 3 voltas completas de giro acumulado.
    expect((angles[angles.length - 1] ?? 0) - (angles[0] ?? 0)).toBeGreaterThan(20);
  });

  it('usa apenas valores de paleta, tamanho e opacidade válidos', () => {
    for (const star of generateGalaxy({ count: 200 })) {
      expect(Number.isInteger(star.colorIndex)).toBe(true);
      expect(star.colorIndex).toBeGreaterThanOrEqual(0);
      expect(star.colorIndex).toBeLessThan(PALETTE_SIZE);
      expect(star.size).toBeGreaterThanOrEqual(0.5);
      expect(star.size).toBeLessThanOrEqual(3.2);
      expect(star.opacity).toBeGreaterThan(0);
      expect(star.opacity).toBeLessThanOrEqual(1);
    }
  });
});
