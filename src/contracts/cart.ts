import type { Eth } from "./common";
export interface CartItem {
  id: string;
  nftId: string;
  editionId: string;
  quantity: number;
  unitPriceEth: Eth;
}
export interface Cart {
  id: string;
  version: number;
  items: CartItem[];
}
export interface AddCartItemRequest {
  nftId: string;
  editionId: string;
  quantity: number;
}
export interface ChangeQuantityRequest {
  quantity: number;
}
