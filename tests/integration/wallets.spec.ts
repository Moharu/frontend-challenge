import { test, expect } from "@playwright/test";
import { validateWallet } from "../../src/contracts/wallets";
// The duplicate case is flagged explicitly; the server's 409 vs 400 follows
// this flag, never the message text.
const existing = [{ address: "0x1111111111111111111111111111111111111111" }];
const base = { network: "ethereum", provider: "metamask", label: "Principal" };
test("endereço duplicado é sinalizado explicitamente, sem diferenciar maiúsculas", () => {
  const result = validateWallet(
    {
      ...base,
      address: "0x1111111111111111111111111111111111111111"
        .toUpperCase()
        .replace("0X", "0x"),
    },
    existing,
  );
  expect(result.duplicate).toBe(true);
  expect(result.fields.address).toBeTruthy();
});
test("endereço inválido e outros erros de campo não são duplicidade", () => {
  for (const input of [
    { ...base, address: "0x123" },
    { ...base, address: "" },
    {
      ...base,
      address: "0x2222222222222222222222222222222222222222",
      label: "",
    },
    {
      ...base,
      network: "solana",
      address: "0x2222222222222222222222222222222222222222",
    },
  ]) {
    const result = validateWallet(input, existing);
    expect(result.duplicate).toBe(false);
    expect(Object.keys(result.fields).length).toBeGreaterThan(0);
  }
  expect(
    validateWallet(
      { ...base, address: "0x2222222222222222222222222222222222222222" },
      existing,
    ),
  ).toEqual({ fields: {}, duplicate: false });
});
