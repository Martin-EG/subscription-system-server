export interface UserAccess {
  userId: string;
  hasPremiumAccess: boolean;
  validUntil: Date;
  updatedAt: Date;
}
