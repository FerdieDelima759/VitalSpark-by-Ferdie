/**
 * Utility function to apply scaling to values
 * Matches the mobile app's scaling logic
 */
export function scaleValue(value: number, scale: number): number {
  return value * scale;
}

/**
 * Convert scaled value to CSS string with 'px'
 */
export function scale(value: number, scale: number): string {
  return `${value * scale}px`;
}

