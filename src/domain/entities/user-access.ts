export interface UserAccess {
  userId: string;
  hasPremiumAccess: boolean;
  validUntil: Date | null;
  updatedAt: Date;
}
