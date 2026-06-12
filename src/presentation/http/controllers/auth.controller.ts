import type { RequestHandler } from 'express';
import type { LoginInput } from '../../../application/dtos';
import type { LoginUseCase } from '../../../application/use-cases';

export function createLoginController(
  loginUseCase: LoginUseCase,
  isProduction: boolean,
): RequestHandler {
  return async (request, response, next) => {
    try {
      const result = await loginUseCase.execute(request.body as LoginInput);

      response.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: result.expiresIn * 1000,
        path: '/',
      });

      response.status(200).json({
        access_token: result.accessToken,
        expires_in: result.expiresIn,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  };
}
