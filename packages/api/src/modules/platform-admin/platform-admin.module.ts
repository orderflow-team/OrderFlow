import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business, User, Product, Order, UserActivityLog } from '../../database/entities';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminController } from './platform-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, User, Product, Order, UserActivityLog]),
  ],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService],
  exports: [PlatformAdminService],
})
export class PlatformAdminModule {}
