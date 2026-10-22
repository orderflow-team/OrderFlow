import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PATH_METADATA } from '@nestjs/common/constants';
import { ServiceUnavailableException } from '@nestjs/common';
import { AppController, HEALTH_CACHE_MS, HEALTH_TIMEOUT_MS } from './app.controller';

describe('AppController', () => {
  let controller: AppController;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: DataSource, useValue: dataSource }],
    }).compile();

    controller = module.get(AppController);
    jest.spyOn(controller['logger'], 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('health', () => {
    it('is served at /health and at /api/health (the only path the proxy forwards)', () => {
      const paths = Reflect.getMetadata(PATH_METADATA, AppController.prototype.health);

      expect(paths).toEqual(['health', 'api/health']);
    });

    it('pings the database and reports only ok and a timestamp', async () => {
      const result = await controller.health();

      expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(Object.keys(result).sort()).toEqual(['status', 'timestamp']);
    });

    it('reuses one database query for concurrent and repeated requests inside the cache window', async () => {
      await Promise.all([controller.health(), controller.health(), controller.health()]);
      await controller.health();

      expect(dataSource.query).toHaveBeenCalledTimes(1);
    });

    it('queries again once the cache window has passed', async () => {
      await controller.health();
      jest.advanceTimersByTime(HEALTH_CACHE_MS + 1);
      await controller.health();

      expect(dataSource.query).toHaveBeenCalledTimes(2);
    });

    it('answers 503 with a fixed body, never the driver error text', async () => {
      dataSource.query.mockRejectedValue(new Error('password authentication failed for user "orderflow_admin"'));

      const failure = controller.health();

      await expect(failure).rejects.toBeInstanceOf(ServiceUnavailableException);
      await failure.catch((e) => {
        expect(e.getStatus()).toBe(503);
        expect(e.getResponse()).toEqual({ status: 'unavailable' });
      });
    });

    it('fails the check when the database does not answer in time', async () => {
      dataSource.query.mockReturnValue(new Promise(() => undefined));

      const failure = controller.health();
      jest.advanceTimersByTime(HEALTH_TIMEOUT_MS + 1);

      await expect(failure).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('recovers on the next window after a failure', async () => {
      dataSource.query.mockRejectedValueOnce(new Error('down'));
      await expect(controller.health()).rejects.toBeInstanceOf(ServiceUnavailableException);

      jest.advanceTimersByTime(HEALTH_CACHE_MS + 1);

      await expect(controller.health()).resolves.toMatchObject({ status: 'ok' });
    });

    it('has a per-IP throttle tighter than the global 300/min', () => {
      const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', AppController.prototype.health);

      expect(limit).toBe(30);
    });
  });
});
