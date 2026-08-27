import { Test, TestingModule } from '@nestjs/testing';
import { DevToolsController } from './dev-tools.controller';
import { DevToolsService } from './dev-tools.service';

describe('DevToolsController', () => {
  let controller: DevToolsController;
  let service: jest.Mocked<DevToolsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevToolsController],
      providers: [
        { provide: DevToolsService, useValue: { seedAll: jest.fn(), clearModule: jest.fn(), clearAll: jest.fn() } },
      ],
    }).compile();

    controller = module.get(DevToolsController);
    service = module.get(DevToolsService);
  });

  it('seedAll delegates to the service', () => {
    controller.seedAll('biz-1');
    expect(service.seedAll).toHaveBeenCalledWith('biz-1');
  });

  it('clearModule delegates to the service', () => {
    controller.clearModule('products', 'biz-1');
    expect(service.clearModule).toHaveBeenCalledWith('products', 'biz-1');
  });

  it('clearAll delegates to the service', () => {
    controller.clearAll('biz-1');
    expect(service.clearAll).toHaveBeenCalledWith('biz-1');
  });
});
