import type { LoginInput, LoginOutput } from '../dtos/auth.dto.js';
import type { AuthProvider } from '../ports/auth-provider.port.js';

export class LoginUseCase {
  constructor(private readonly authProvider: AuthProvider) {}

  execute(input: LoginInput): Promise<LoginOutput> {
    return this.authProvider.login(input);
  }
}
