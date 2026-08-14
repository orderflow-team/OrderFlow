import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Business, User, Product, Order, UserActivityLog, BusinessConnection } from '../../database/entities';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminController } from './platform-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, User, Product, Order, UserActivityLog, BusinessConnection]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'orderflow-secret-key-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService],
  exports: [PlatformAdminService],
})
export class PlatformAdminModule {}
