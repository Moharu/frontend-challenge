import type { UserIdentity } from "./common";
// Contract only: no account/session backend or client behavior yet.
export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface Session {
  id: string;
  user: UserIdentity;
  expiresAt: string;
  generation: number;
}
export interface AuthResponse {
  session: Session;
}
