import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../../database/entities/business.entity';
import { User } from '../../database/entities/user.entity';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { AuthModule } from '../auth/auth.module';
import { DevToolsModule } from '../dev-tools/dev-tools.module';

@Module({
  imports: [TypeOrmModule.forFeature([Business, User]), AuthModule, DevToolsModule],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
