export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export interface PasswordResetRepository {
  createToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;
  markUsed(tokenHash: string): Promise<void>;
  deleteUnusedByUserId(userId: string): Promise<void>;
}
