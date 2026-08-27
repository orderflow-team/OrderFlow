import { Test, TestingModule } from '@nestjs/testing';
import { SalesmanController } from './salesman.controller';
import { SalesmanService } from './salesman.service';

describe('SalesmanController', () => {
  let controller: SalesmanController;
  let service: jest.Mocked<SalesmanService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesmanController],
      providers: [
        {
          provide: SalesmanService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            createLogin: jest.fn(),
            getLoginCredentials: jest.fn(),
            updateLogin: jest.fn(),
            remove: jest.fn(),
            checkIn: jest.fn(),
            checkOut: jest.fn(),
            findVisitsBySalesman: jest.fn(),
            findVisitsByCustomer: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(SalesmanController);
    service = module.get(SalesmanService);
  });

  it('create delegates to the service', () => {
    const dto = { businessId: 'biz-1', name: 'Ravi' } as any;
    controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delegates to the service', () => {
    controller.findAll('biz-1');
    expect(service.findAll).toHaveBeenCalledWith('biz-1');
  });

  it('findOne delegates to the service', () => {
    controller.findOne('sm-1', 'biz-1');
    expect(service.findOne).toHaveBeenCalledWith('sm-1', 'biz-1');
  });

  it('createLogin delegates to the service', () => {
    const dto = { email: 'a@b.com', password: 'x' } as any;
    controller.createLogin('sm-1', 'biz-1', dto);
    expect(service.createLogin).toHaveBeenCalledWith('sm-1', 'biz-1', dto);
  });

  it('getLogin delegates to the service', () => {
    controller.getLogin('sm-1', 'biz-1');
    expect(service.getLoginCredentials).toHaveBeenCalledWith('sm-1', 'biz-1');
  });

  it('updateLogin delegates to the service', () => {
    const dto = { email: 'new@b.com' } as any;
    controller.updateLogin('sm-1', 'biz-1', dto);
    expect(service.updateLogin).toHaveBeenCalledWith('sm-1', 'biz-1', dto);
  });

  it('remove delegates to the service', () => {
    controller.remove('sm-1', 'biz-1');
    expect(service.remove).toHaveBeenCalledWith('sm-1', 'biz-1');
  });

  it('checkIn delegates to the service', () => {
    const dto = { salesmanId: 'sm-1', businessId: 'biz-1' } as any;
    controller.checkIn(dto);
    expect(service.checkIn).toHaveBeenCalledWith(dto);
  });

  it('checkOut delegates to the service', () => {
    controller.checkOut('visit-1', 'biz-1');
    expect(service.checkOut).toHaveBeenCalledWith('visit-1', 'biz-1');
  });

  it('findVisitsBySalesman delegates to the service', () => {
    controller.findVisitsBySalesman('sm-1', 'biz-1');
    expect(service.findVisitsBySalesman).toHaveBeenCalledWith('sm-1', 'biz-1');
  });

  it('findVisitsByCustomer delegates to the service', () => {
    controller.findVisitsByCustomer('cust-1', 'biz-1');
    expect(service.findVisitsByCustomer).toHaveBeenCalledWith('cust-1', 'biz-1');
  });
});
