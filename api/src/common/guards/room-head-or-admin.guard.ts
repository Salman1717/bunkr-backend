import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class RoomHeadOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || (!user.isAdmin && !user.isRoomHead)) {
      throw new ForbiddenException('Admin or Room Head access required');
    }
    return true;
  }
}
