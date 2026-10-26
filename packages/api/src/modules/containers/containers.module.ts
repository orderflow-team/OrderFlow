import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContainerLedger } from '../../database/entities/container-ledger.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Product } from '../../database/entities/product.entity';
import { ContainersController } from './containers.controller';
import { ContainersService } from './containers.service';

@Module({
  imports: [TypeOrmModule.forFeature([ContainerLedger, Customer, Product])],
  controllers: [ContainersController],
  providers: [ContainersService],
  exports: [ContainersService],
})
export class ContainersModule {}
