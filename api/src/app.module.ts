import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MembersModule } from './modules/members/members.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { RentModule } from './modules/rent/rent.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { BigIntTransformInterceptor } from './common/interceptors/bigint-transform.interceptor';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MembersModule,
    RoomsModule,
    RentModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: BigIntTransformInterceptor,
    },
  ],
})
export class AppModule {}
