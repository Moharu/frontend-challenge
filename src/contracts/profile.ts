export interface Profile {
  userId: string;
  displayName: string;
  email: string;
  bio: string;
  avatar: string | null;
  version: number;
}
export interface UpdateProfileRequest {
  displayName: string;
  email: string;
  bio: string;
  version: number;
}
export interface UpdateAvatarRequest {
  dataUrl: string | null;
  version: number;
}
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
