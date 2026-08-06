import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppApkRelease } from '../../database/entities/app-apk-release.entity';
import { AppApkReleasesController } from './app-apk-releases.controller';
import { AppApkReleasesService } from './app-apk-releases.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppApkRelease])],
  controllers: [AppApkReleasesController],
  providers: [AppApkReleasesService],
})
export class AppApkReleasesModule {}
