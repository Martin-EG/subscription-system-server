import type { LoginInput, LoginOutput } from '../dtos';

export interface AuthProvider {
  login(input: LoginInput): Promise<LoginOutput>;
  verifyAccessToken(accessToken: string): Promise<LoginOutput['user']>;
}
