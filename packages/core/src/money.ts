export const USDC_DECIMALS = 6;
const UNITS_PER_USDC = 10 ** USDC_DECIMALS;

export function formatUsdc(units: number): string {
  return (units / UNITS_PER_USDC).toFixed(2);
}
