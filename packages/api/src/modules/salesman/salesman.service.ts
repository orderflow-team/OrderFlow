import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Salesman } from '../../database/entities/salesman.entity';
import { Visit } from '../../database/entities/visit.entity';
import { CreateSalesmanDto } from './dto/create-salesman.dto';
import { CheckinVisitDto } from './dto/checkin-visit.dto';

@Injectable()
export class SalesmanService {
  constructor(
    @InjectRepository(Salesman) private salesmenRepository: Repository<Salesman>,
    @InjectRepository(Visit) private visitsRepository: Repository<Visit>,
  ) {}

  create(dto: CreateSalesmanDto) {
    const salesman = this.salesmenRepository.create({
      business_id: dto.businessId,
      user_id: dto.userId,
      name: dto.name,
      phone: dto.phone,
      route: dto.route,
    });
    return this.salesmenRepository.save(salesman);
  }

  findAll(businessId: string) {
    return this.salesmenRepository.find({ where: { business_id: businessId }, order: { name: 'ASC' } });
  }

  async findOne(id: string, businessId: string) {
    const salesman = await this.salesmenRepository.findOne({ where: { id, business_id: businessId } });
    if (!salesman) {
      throw new NotFoundException('Salesman not found');
    }
    return salesman;
  }

  checkIn(dto: CheckinVisitDto) {
    const visit = this.visitsRepository.create({
      salesman_id: dto.salesmanId,
      customer_id: dto.customerId,
      check_in_time: new Date(),
      gps_location: dto.gpsLocation,
      notes: dto.notes,
    });
    return this.visitsRepository.save(visit);
  }

  async checkOut(id: string) {
    const visit = await this.visitsRepository.findOne({ where: { id } });
    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    if (visit.check_out_time) {
      throw new BadRequestException('Visit already checked out');
    }
    visit.check_out_time = new Date();
    return this.visitsRepository.save(visit);
  }

  findVisitsBySalesman(salesmanId: string) {
    return this.visitsRepository.find({ where: { salesman_id: salesmanId }, order: { created_at: 'DESC' } });
  }

  findVisitsByCustomer(customerId: string) {
    return this.visitsRepository.find({ where: { customer_id: customerId }, order: { created_at: 'DESC' } });
  }
}
