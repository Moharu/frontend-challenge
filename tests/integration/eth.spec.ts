import { test, expect } from "@playwright/test";
import {
  addEth,
  compareEth,
  formatEth,
  fromEthUnits,
  minEth,
  multiplyEth,
  normalizeEth,
  percentOfEth,
  subtractEth,
} from "../../src/contracts/eth";
// Pure arithmetic: runs in Node without a page, through the shared module used
// by both the MSW handlers and the interface.
test("soma valores que não fecham em ponto flutuante", () => {
  expect(0.1 + 0.2).not.toBe(0.3);
  expect(addEth("0.1", "0.2")).toBe("0.3");
  expect(addEth("1.000000000000000001", "0.000000000000000002")).toBe(
    "1.000000000000000003",
  );
  expect(addEth()).toBe("0");
});
test("subtração tem piso zero e multiplicação usa quantidades inteiras", () => {
  expect(subtractEth("2.38", "0.1")).toBe("2.28");
  expect(subtractEth("0.08", "0.1")).toBe("0");
  expect(multiplyEth("1.000000000000000001", 3)).toBe("3.000000000000000003");
  expect(multiplyEth("15", 1000)).toBe("15000");
  expect(() => multiplyEth("1", 1.5)).toThrow();
  expect(() => multiplyEth("1", -1)).toThrow();
  expect(multiplyEth("9007199254740993.000000000000000001", 1000)).toBe(
    "9007199254740993000.000000000000001",
  );
});
test("desconto percentual arredonda para baixo na menor unidade", () => {
  expect(percentOfEth("2.38", 1000)).toBe("0.238");
  expect(percentOfEth("0.000000000000000019", 1000)).toBe(
    "0.000000000000000001",
  );
  expect(percentOfEth("0.000000000000000009", 1000)).toBe("0");
  expect(percentOfEth("3.000000000000000003", 1500)).toBe("0.45");
  expect(minEth("0.1", "0.08")).toBe("0.08");
  expect(compareEth("0.30", "0.3")).toBe(0);
});
test("formatação de exibição mantém casas significativas sem notação exponencial", () => {
  expect(formatEth("26")).toBe("26.00");
  expect(formatEth("1.5")).toBe("1.50");
  expect(formatEth("0.016")).toBe("0.016");
  expect(formatEth("26.846")).toBe("26.846");
  expect(formatEth("0.000000000000000001")).toBe("0.000000000000000001");
  expect(formatEth("100000000000000000000000")).toBe(
    "100000000000000000000000.00",
  );
  expect(normalizeEth("1.500")).toBe("1.5");
  expect(fromEthUnits(10n ** 18n)).toBe("1");
  expect(() => fromEthUnits(-1n)).toThrow();
});
