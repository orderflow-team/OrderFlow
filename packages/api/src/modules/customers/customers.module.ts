import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../../database/entities/customer.entity';
import { Business } from '../../database/entities/business.entity';
import { EvolutionApiService } from '../whatsapp/evolution-api.service';
import { CustomerReminderService } from './customer-reminder.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, Business])],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerReminderService, EvolutionApiService],
  exports: [CustomersService],
})
export class CustomersModule {}
