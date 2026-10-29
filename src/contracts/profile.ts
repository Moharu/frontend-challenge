export interface Profile {
  userId: string;
  displayName: string | null;
  username: string;
  email: string;
  ensName: string | null;
  walletNickname: string | null;
  bio: string | null;
  avatar: string | null;
  version: number;
}
export interface UpdateProfileRequest {
  version: number;
  username?: string;
  email?: string;
  displayName?: string | null;
  ensName?: string | null;
  walletNickname?: string | null;
  bio?: string | null;
}
export interface UpdateAvatarRequest {
  dataUrl: string | null;
  version: number;
}
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
