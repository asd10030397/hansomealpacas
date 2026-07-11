"use client";

import { useReducedMotion } from "framer-motion";
import { useMemo } from "react";

const PARTICLE_COUNT = 12;

function createParticles(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    left: `${(index * 17 + 7) % 100}%`,
    top: `${(index * 23 + 11) % 100}%`,
    size: 2 + (index % 4),
    duration: 5 + (index % 6),
    delay: (index % 8) * 0.4,
    opacity: 0.12 + (index % 4) * 0.05,
  }));
}

export function FloatingParticles() {
  const reduceMotion = useReducedMotion();
  const particles = useMemo(() => createParticles(PARTICLE_COUNT), []);

  if (reduceMotion) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="particle absolute rounded-full bg-gold"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
            opacity: particle.opacity,
            ["--drift-duration" as string]: `${particle.duration}s`,
            ["--drift-delay" as string]: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
