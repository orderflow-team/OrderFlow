import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

describe('ExpensesController', () => {
  let controller: ExpensesController;
  let service: jest.Mocked<ExpensesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpensesController],
      providers: [
        { provide: ExpensesService, useValue: { create: jest.fn(), findAll: jest.fn(), remove: jest.fn() } },
      ],
    }).compile();

    controller = module.get(ExpensesController);
    service = module.get(ExpensesService);
  });

  it('create delegates to the service', () => {
    const dto = { businessId: 'biz-1', category: 'Rent', amount: 500 } as any;
    controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delegates with businessId/from/to query params', () => {
    controller.findAll('biz-1', '2026-01-01', '2026-01-31');
    expect(service.findAll).toHaveBeenCalledWith('biz-1', '2026-01-01', '2026-01-31');
  });

  it('remove delegates with id and businessId', () => {
    controller.remove('e1', 'biz-1');
    expect(service.remove).toHaveBeenCalledWith('e1', 'biz-1');
  });
});
