export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
}

export interface LoginOutput {
  accessToken: string;
  expiresIn: number;
  user: AuthenticatedUser;
}
