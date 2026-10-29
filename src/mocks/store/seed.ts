import { categories, type Nft } from "@/contracts/nfts";
import type { UserIdentity } from "@/contracts/common";
import type { Wallet } from "@/contracts/wallets";
import type { PasswordHash } from "./passwords";
export const baseline = "2026-01-01T00:00:00.000Z";
export const fixtureUsers: UserIdentity[] = [
  {
    id: "user-ada",
    username: "ada_example",
    displayName: "Ada Example",
    email: "ada@example.test",
  },
  {
    id: "user-lin",
    username: "lin_example",
    displayName: "Lin Example",
    email: "lin@example.test",
  },
];
export function seedNfts(): Nft[] {
  return Array.from({ length: 24 }, (_, i) => ({
    id: `nft-${String(i + 1).padStart(3, "0")}`,
    name: `${["Emerald Ape", "Sage Nomad", "Noon Verbal", "Cosmic Bloom", "Violet Nomad", "Ivory Baron"][i % 6]} #${String(i + 42).padStart(3, "0")}`,
    category:
      i < 18
        ? (["art", "music", "photography"] as const)[i % 3]
        : categories[i - 15],
    network: i >= 18 ? "solana" : i % 2 ? "polygon" : "ethereum",
    artwork: ["emerald", "sage", "ivory", "sage", "sage", "golden"][i % 6],
    tokenId: String(i + 42).padStart(3, "0"),
    collection: {
      id: i < 12 ? "kurio-apes" : "kurio-editions",
      name: i < 12 ? "Kurio Apes" : "Kurio Editions",
    },
    description:
      "Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na rede, com arte desbloqueável e acesso para colecionadores.",
    fullDescription:
      "Uma obra digital que explora identidade, movimento e luz em um mundo digital sem fronteiras. Cada atributo fica registrado nos metadados do token. A propriedade inclui acesso à arte em alta resolução e um registro permanente de procedência. Todos os contratos e transações desta demonstração são simulados.",
    gallery: Array.from(
      { length: 4 },
      () => ["emerald", "sage", "ivory", "sage", "sage", "golden"][i % 6],
    ),
    attributes: [
      { name: "Estilo", value: "Retrato" },
      { name: "Coleção", value: "Edições de artista" },
      { name: "Acessório", value: i % 2 ? "Chapéu" : "Óculos" },
    ],
    metadata: {
      contract: "0x7f42…19C8 (simulado)",
      standard: "ERC-721",
      royalty: "5%",
      provenance:
        "Arte digital da coleção KURIO; procedência simulada, sem transação na blockchain.",
    },
    discovery: {
      isNew: i < 8,
      trendingScore: ((i * 7) % 24) * 10,
      rarity: i % 5 === 0 ? "Raro" : null,
    },
    reviews: [
      {
        id: `review-${i}`,
        author: "Colecionador KURIO",
        rating: 5,
        content:
          "Uma peça cheia de personalidade e detalhes. Avaliação fictícia para demonstração.",
      },
    ],
    createdAt: new Date(Date.parse(baseline) - i * 60000).toISOString(),
    updatedAt: baseline,
    version: 1,
    editions: [
      {
        id: `edition-${i + 1}-limited`,
        type: "limited",
        label: "1/20",
        purchaseLimit: 5,
        priceEth: i === 0 ? "1.19" : i === 1 ? "1.69" : String((i % 7) + 1),
        supply: 20,
        available: 10,
      },
      {
        id: `edition-${i + 1}-unique`,
        type: "unique",
        label: "1/1",
        purchaseLimit: 1,
        priceEth: "12",
        supply: 1,
        available: 1,
      },
      {
        id: `edition-${i + 1}-open`,
        type: "open",
        label: "Aberta",
        purchaseLimit: 3,
        priceEth: "15",
        supply: 100,
        available: i === 0 ? 0 : 30,
      },
    ],
  }));
}
// Demo coupons. Validity uses the simulation's logical clock (baseline + tick
// seconds), never the real clock. Discounts apply to the subtotal only.
export interface CouponFixture {
  code: string;
  description: string;
  discount: { basisPoints: number } | { amountEth: string };
  expiresAt: string;
}
export const coupons: CouponFixture[] = [
  {
    code: "KURIO10",
    description: "10% de desconto no subtotal",
    discount: { basisPoints: 1000 },
    expiresAt: "2027-01-01T00:00:00.000Z",
  },
  {
    code: "LANCAMENTO",
    description: "Desconto do lançamento de 0.1 ETH",
    discount: { amountEth: "0.1" },
    expiresAt: "2027-01-01T00:00:00.000Z",
  },
  {
    code: "KURIO15",
    description: "15% de desconto no subtotal",
    discount: { basisPoints: 1500 },
    expiresAt: "2025-12-31T00:00:00.000Z",
  },
];
// Fixed fee per order and network, in ETH like every simulated amount.
export const networkFees = {
  ethereum: "0.016",
  polygon: "0.002",
  solana: "0.0005",
} as const;
export const defaultFeeNetwork = "ethereum" as const;
// Fictional accounts. Only salt + PBKDF2 hash are stored; the demo passwords
// are documented in the README and were hashed with scripts/hash-password.mjs.
export const fixturePasswords: Record<string, PasswordHash> = {
  "user-ada": {
    algorithm: "PBKDF2-SHA256",
    iterations: 100000,
    salt: "Cjh0lOnU2SIMhMyqfAMicw==",
    hash: "NY1g015qqiKKjWgU5lWVHuh13R/O33bM7y5RxYooFWw=",
  },
  "user-lin": {
    algorithm: "PBKDF2-SHA256",
    iterations: 100000,
    salt: "rVgpBHJFkZMt1siIJjoKdA==",
    hash: "m5XQ5MPe5nqk95RjARCo68SZG1baSN+OiJNi0HKbD6Q=",
  },
};
// Ada's wallets, as in the mobile payment frame. Lin starts without wallets
// to exercise registering one inside the checkout.
export const fixtureWallets: Wallet[] = [
  {
    id: "wallet-ada-primary",
    userId: "user-ada",
    address: "0xA91F3c5e7B2d4a6F8091bC3d5E7f9A1b2C4dE82C",
    network: "ethereum",
    provider: "metamask",
    role: "primary",
    version: 1,
    label: "Principal",
    displayName: "Ada Example",
    profileName: "Ada Colecionadora",
    referralCode: null,
    email: "ada@example.test",
    ensName: null,
    secondaryAddressOrEns: null,
  },
  {
    id: "wallet-ada-reserve",
    userId: "user-ada",
    address: "0x7c3D9e1A5b8F2a4C6d0E9f1B3a5C7e9D1f2A4b6C",
    network: "polygon",
    provider: "coinbase-wallet",
    role: "secondary",
    version: 1,
    label: "Reserva",
    displayName: "Ada Example",
    profileName: "Ada Colecionadora",
    referralCode: null,
    email: "ada@example.test",
    ensName: "nova.kurio.eth",
    secondaryAddressOrEns: null,
  },
];
// Sessions last 7 days from login (real clock); scenario controls can expire
// or revoke the current session for deterministic tests.
export const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;
