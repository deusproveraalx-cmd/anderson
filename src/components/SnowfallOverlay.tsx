import React, { useMemo } from 'react';

interface Snowflake {
  id: number;
  leftPercent: number;
  sizePx: number;
  opacity: number;
  durationSec: number;
  delaySec: number;
  swayPx: number;
  isCrystal: boolean;
}

export const SnowfallOverlay: React.FC = () => {
  const snowflakes = useMemo<Snowflake[]>(() => {
    const count = 42;
    return Array.from({ length: count }, (_, idx) => {
      const seed1 = ((idx * 37 + 13) % 100) / 100;
      const seed2 = ((idx * 53 + 7) % 100) / 100;
      const seed3 = ((idx * 71 + 29) % 100) / 100;

      const isCrystal = idx % 3 === 0;
      return {
        id: idx,
        leftPercent: Math.round(seed1 * 97 * 10) / 10,
        sizePx: isCrystal
          ? Math.round((16 + seed2 * 10) * 10) / 10
          : Math.round((8 + seed2 * 8) * 10) / 10,
        opacity: Math.round((0.72 + seed3 * 0.26) * 100) / 100,
        durationSec: Math.round((9 + seed2 * 8) * 10) / 10,
        delaySec: Math.round(-seed3 * 16 * 10) / 10,
        swayPx: Math.round((seed1 - 0.5) * 56),
        isCrystal,
      };
    });
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden select-none"
    >
      {snowflakes.map((flake) =>
        flake.isCrystal ? (
          <svg
            key={flake.id}
            viewBox="0 0 24 24"
            fill="none"
            className="christmas-snowflake-svg"
            style={
              {
                left: `${flake.leftPercent}%`,
                width: `${flake.sizePx}px`,
                height: `${flake.sizePx}px`,
                opacity: flake.opacity,
                animationDuration: `${flake.durationSec}s`,
                animationDelay: `${flake.delaySec}s`,
                '--snow-sway': `${flake.swayPx}px`,
              } as React.CSSProperties
            }
          >
            <path
              d="M12 2V22M3.34 7L20.66 17M20.66 7L3.34 17M9.5 4.5L12 7L14.5 4.5M9.5 19.5L12 17L14.5 19.5M4.5 9.5L7.5 10L6.5 13M19.5 14.5L16.5 14L17.5 11M19.5 9.5L16.5 10L17.5 13M4.5 14.5L7.5 14L6.5 11"
              stroke="#FFFFFF"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span
            key={flake.id}
            className="christmas-snowflake"
            style={
              {
                left: `${flake.leftPercent}%`,
                width: `${flake.sizePx}px`,
                height: `${flake.sizePx}px`,
                opacity: flake.opacity,
                animationDuration: `${flake.durationSec}s`,
                animationDelay: `${flake.delaySec}s`,
                '--snow-sway': `${flake.swayPx}px`,
              } as React.CSSProperties
            }
          />
        )
      )}
    </div>
  );
};
