import type { LoginInput, LoginOutput } from '../dtos';
import type { AuthProvider } from '../ports';

export class LoginUseCase {
  constructor(private readonly authProvider: AuthProvider) {}

  execute(input: LoginInput): Promise<LoginOutput> {
    return this.authProvider.login(input);
  }
}
