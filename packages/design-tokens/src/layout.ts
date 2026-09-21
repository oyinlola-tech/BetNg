export const spacing = Object.freeze({
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
});

export const radius = Object.freeze({
  none: 0,
  xs: 3,
  sm: 5,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
});

export const shadow = Object.freeze({
  sm: "0 1px 2px rgba(10, 12, 16, 0.06)",
  md: "0 4px 12px rgba(10, 12, 16, 0.10), 0 1px 3px rgba(10, 12, 16, 0.06)",
  lg: "0 16px 40px rgba(10, 12, 16, 0.18), 0 2px 8px rgba(10, 12, 16, 0.08)",
});

export const breakpoint = Object.freeze({
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
});

export const zIndex = Object.freeze({
  base: 0,
  raised: 1,
  sticky: 10,
  drawer: 20,
  sheet: 30,
  modal: 40,
  toast: 50,
  broadcast: 60,
});

export const minTouchTarget = 44;

export const borderWidth = Object.freeze({ hairline: 1, strong: 2 });

export const controlHeight = Object.freeze({ xs: 24, sm: 32, md: 40, lg: 48 });

export const iconSize = Object.freeze({ xs: 12, sm: 16, md: 20, lg: 24, xl: 32 });

export const crestSizes = Object.freeze([
  16, 20, 24, 32, 40, 48, 64, 80, 96, 128,
] as const);

export type CrestSize = (typeof crestSizes)[number];

export const screen = Object.freeze({
  smallMobile: 320,
  largeMobile: 430,
  tablet: 768,
  laptop: 1024,
  desktop: 1280,
  largeDesktop: 1536,
  tv: 1920,
});
