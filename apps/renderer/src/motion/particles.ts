import { random } from "./random";

export const MAX_PARTICLES = 240;
export const MAX_PARTICLE_LIFETIME = 240;

export interface BurstOptions {
  seed: number;
  /** Frame the burst starts (local frames). */
  start: number;
  count: number;
  origin: { x: number; y: number };
  /** Direction in degrees (0 = right, -90 = up) and total spread around it. */
  direction?: number;
  spread?: number;
  /** Initial speed range in design pixels per frame. */
  speed?: [number, number];
  /** Lifetime range in frames. */
  lifetime?: [number, number];
  /** Downward acceleration (px/frame^2) and velocity drag per frame (0..1). */
  gravity?: number;
  drag?: number;
  size?: [number, number];
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  size: number;
  rotate: number;
  opacity: number;
  /** 0..1 through the particle's life. */
  age: number;
}

/**
 * Seeded particle burst evaluated in closed form at `frame`, so any frame can be
 * rendered without simulating earlier ones. Count and lifetime are bounded.
 */
export function burst(frame: number, opts: BurstOptions): Particle[] {
  if (!Number.isInteger(opts.count) || opts.count < 0 || opts.count > MAX_PARTICLES) {
    throw new Error(`Particle count must be an integer from 0 to ${MAX_PARTICLES}`);
  }
  const [lifeMin, lifeMax] = opts.lifetime ?? [18, 36];
  if (!(lifeMin > 0 && lifeMax >= lifeMin && lifeMax <= MAX_PARTICLE_LIFETIME)) {
    throw new Error(`Particle lifetime must be within 1..${MAX_PARTICLE_LIFETIME} frames`);
  }
  const t = frame - opts.start;
  if (t < 0) return [];
  const [speedMin, speedMax] = opts.speed ?? [6, 14];
  const [sizeMin, sizeMax] = opts.size ?? [6, 14];
  const direction = ((opts.direction ?? -90) * Math.PI) / 180;
  const spread = ((opts.spread ?? 120) * Math.PI) / 180;
  const gravity = opts.gravity ?? 0.35;
  const drag = Math.min(0.99, Math.max(0, opts.drag ?? 0.08));
  const particles: Particle[] = [];
  for (let i = 0; i < opts.count; i++) {
    const life = lifeMin + (lifeMax - lifeMin) * random(opts.seed, i, "life");
    if (t > life) continue;
    const angle = direction + (random(opts.seed, i, "angle") - 0.5) * spread;
    const speed = speedMin + (speedMax - speedMin) * random(opts.seed, i, "speed");
    // Closed form of v *= (1 - drag) per frame: distance = v0 * (1 - k^t) / (1 - k).
    const k = 1 - drag;
    const travelled = drag === 0 ? t : (1 - k ** t) / (1 - k);
    const age = t / life;
    particles.push({
      id: `p${i}`,
      x: opts.origin.x + Math.cos(angle) * speed * travelled,
      y: opts.origin.y + Math.sin(angle) * speed * travelled + 0.5 * gravity * t * t,
      size: sizeMin + (sizeMax - sizeMin) * random(opts.seed, i, "size"),
      rotate: (random(opts.seed, i, "spin") - 0.5) * 40 * t,
      opacity: age < 0.7 ? 1 : Math.max(0, 1 - (age - 0.7) / 0.3),
      age,
    });
  }
  return particles;
}
