import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppRelease } from '../../database/entities/app-release.entity';
import { AppUpdatesController } from './app-updates.controller';
import { AppUpdatesService } from './app-updates.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppRelease])],
  controllers: [AppUpdatesController],
  providers: [AppUpdatesService],
})
export class AppUpdatesModule {}
