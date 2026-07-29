export const GRADIENTS = {
  sunset: ['#FFC28A', '#FF6B4A'] as const,
  lagoon: ['#8FE3D3', '#2E9E8F'] as const,
  dusk: ['#C9A6FF', '#7C6CF2'] as const,
  berry: ['#FF9AA8', '#E8577D'] as const,
  gold: ['#F6D999', '#C9932F'] as const,
};

export type GradientName = keyof typeof GRADIENTS;
