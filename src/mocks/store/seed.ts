import type { Nft } from "@/contracts/nfts";
import type { UserIdentity } from "@/contracts/common";
export const baseline = "2026-01-01T00:00:00.000Z";
export const fixtureUsers: UserIdentity[] = [
  { id: "user-ada", displayName: "Ada Example", email: "ada@example.test" },
  { id: "user-lin", displayName: "Lin Example", email: "lin@example.test" },
];
export function seedNfts(): Nft[] {
  return Array.from({ length: 24 }, (_, i) => ({
    id: `nft-${String(i + 1).padStart(3, "0")}`,
    name: `${["Aurora", "Rhythm", "Lens"][i % 3]} ${String(i + 1).padStart(2, "0")}`,
    category: (["art", "music", "photography"] as const)[i % 3],
    network: i % 2 ? "polygon" : "ethereum",
    artwork: `local-placeholder:${i + 1}`,
    createdAt: new Date(Date.parse(baseline) - (24 - i) * 60000).toISOString(),
    updatedAt: baseline,
    version: 1,
    editions: [
      {
        id: `edition-${i + 1}-limited`,
        type: "limited",
        priceEth:
          i === 0
            ? "1.000000000000000001"
            : i === 1
              ? "1.000000000000000002"
              : String((i % 7) + 1),
        supply: 20,
        available: 10,
      },
      {
        id: `edition-${i + 1}-unique`,
        type: "unique",
        priceEth: "12",
        supply: 1,
        available: 1,
      },
    ],
  }));
}
