import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayloadUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayloadUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayloadUser;
    return data ? user?.[data] : user;
  },
);
