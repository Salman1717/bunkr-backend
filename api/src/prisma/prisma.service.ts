import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('PrismaService successfully connected to PostgreSQL database.');
    } catch (error) {
      this.logger.error(
        'Unable to connect to PostgreSQL database at localhost:5432.',
      );
      this.logger.error(
        'Please ensure Docker Desktop is running and execute `docker-compose up -d` or start PostgreSQL locally.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
