import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { LoginInput, LoginOutput } from '../../application/dtos';
import type { AuthProvider } from '../../application/ports';
import { UnauthorizedError } from '../../domain/errors';

type SupabaseAuthClient = Pick<SupabaseClient, 'auth'>;

export class SupabaseAuthProvider implements AuthProvider {
  constructor(private readonly client: SupabaseAuthClient) {}

  async login(input: LoginInput): Promise<LoginOutput> {
    const { data, error } = await this.client.auth.signInWithPassword(input);

    if (error || !data.session || !data.user) {
      throw new UnauthorizedError();
    }

    return {
      accessToken: data.session.access_token,
      expiresIn: data.session.expires_in,
      user: this.mapUser(data.user),
    };
  }

  async verifyAccessToken(accessToken: string): Promise<LoginOutput['user']> {
    const { data, error } = await this.client.auth.getUser(accessToken);

    if (error || !data.user) {
      throw new UnauthorizedError();
    }

    return this.mapUser(data.user);
  }

  private mapUser(user: User): LoginOutput['user'] {
    return {
      id: user.id,
      email: user.email ?? '',
      name: this.readMetadataValue(user.user_metadata, 'name'),
      role: this.readMetadataValue(user.app_metadata, 'app_role'),
    };
  }

  private readMetadataValue(metadata: Record<string, unknown>, key: string): string | null {
    const value = metadata[key];
    return typeof value === 'string' ? value : null;
  }
}

export function createSupabaseAuthProvider(url: string, anonKey: string): SupabaseAuthProvider {
  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return new SupabaseAuthProvider(client);
}
