export function formatUsdc(units: number): string {
  return (units / 1_000_000).toFixed(2);
}
