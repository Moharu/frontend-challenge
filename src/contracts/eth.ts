import type { Eth } from "./common";
// ETH uses at most 18 fractional places. Comparison never passes through Number.
export function isEth(value: unknown): value is Eth {
  return (
    typeof value === "string" && /^(0|[1-9]\d{0,59})(\.\d{1,18})?$/.test(value)
  );
}
export function ethUnits(value: Eth): bigint {
  if (!isEth(value)) throw new Error("Invalid decimal ETH amount");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0"));
}
export function compareEth(a: Eth, b: Eth): number {
  const x = ethUnits(a),
    y = ethUnits(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
export function normalizeEth(value: Eth): Eth {
  ethUnits(value);
  const [whole, fraction = ""] = value.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}
