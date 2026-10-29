import type { Eth } from "./common";
// ETH uses at most 18 fractional places. Arithmetic runs on integer units
// (10^-18 ETH) as bigint and never passes through Number.
const scale = 10n ** 18n;
export function isEth(value: unknown): value is Eth {
  return (
    typeof value === "string" && /^(0|[1-9]\d{0,59})(\.\d{1,18})?$/.test(value)
  );
}
export function ethUnits(value: Eth): bigint {
  if (!isEth(value)) throw new Error("Invalid decimal ETH amount");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * scale + BigInt(fraction.padEnd(18, "0"));
}
export function compareEth(a: Eth, b: Eth): number {
  const x = ethUnits(a),
    y = ethUnits(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
export function normalizeEth(value: Eth): Eth {
  return fromEthUnits(ethUnits(value));
}
export function fromEthUnits(units: bigint): Eth {
  if (units < 0n) throw new Error("Negative ETH amount");
  const fraction = (units % scale)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");
  return fraction ? `${units / scale}.${fraction}` : String(units / scale);
}
export function addEth(...values: Eth[]): Eth {
  return fromEthUnits(values.reduce((sum, v) => sum + ethUnits(v), 0n));
}
// Subtraction floors at zero: a discount can never make an amount negative.
export function subtractEth(a: Eth, b: Eth): Eth {
  const result = ethUnits(a) - ethUnits(b);
  return fromEthUnits(result > 0n ? result : 0n);
}
export function multiplyEth(value: Eth, quantity: number): Eth {
  if (!Number.isSafeInteger(quantity) || quantity < 0)
    throw new Error("Quantity must be a non-negative integer");
  return fromEthUnits(ethUnits(value) * BigInt(quantity));
}
// Percentage in integer basis points (1000 = 10%), rounded down to the smallest
// unit so the buyer never receives more discount than advertised.
export function percentOfEth(value: Eth, basisPoints: number): Eth {
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0)
    throw new Error("Basis points must be a non-negative integer");
  return fromEthUnits((ethUnits(value) * BigInt(basisPoints)) / 10000n);
}
export function minEth(a: Eth, b: Eth): Eth {
  return compareEth(a, b) <= 0 ? normalizeEth(a) : normalizeEth(b);
}
// Display only: dot decimal separator, at least two decimals, every significant
// digit kept and never exponential notation.
export function formatEth(value: Eth): string {
  const [whole, fraction = ""] = normalizeEth(value).split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}
