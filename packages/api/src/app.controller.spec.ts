import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: DataSource, useValue: dataSource }],
    }).compile();

    controller = module.get(AppController);
  });

  describe('health', () => {
    it('pings the database and reports latency', async () => {
      const result = await controller.health();

      expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(typeof result.dbLatencyMs).toBe('number');
      expect(result.dbLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('propagates a database failure rather than reporting ok', async () => {
      dataSource.query.mockRejectedValue(new Error('connection refused'));

      await expect(controller.health()).rejects.toThrow('connection refused');
    });
  });
});
