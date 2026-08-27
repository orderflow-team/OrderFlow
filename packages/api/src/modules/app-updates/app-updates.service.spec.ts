import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppUpdatesService } from './app-updates.service';
import { AppRelease } from '../../database/entities/app-release.entity';

const sendMock = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

describe('AppUpdatesService', () => {
  let service: AppUpdatesService;
  let repo: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    sendMock.mockClear();
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((entity) => ({ id: 'release-new', ...entity })),
      save: jest.fn(async (entity) => entity),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AppUpdatesService, { provide: getRepositoryToken(AppRelease), useValue: repo }],
    }).compile();

    service = module.get(AppUpdatesService);
  });

  describe('getLatest', () => {
    it('returns the active release for an exact platform match', async () => {
      repo.findOne.mockResolvedValue({ version: '1.2.0', bundle_url: 'https://x/bundle.zip', checksum: 'abc', min_native_version: '1.0.0', notes: 'fix' });

      const result = await service.getLatest('android-playstore');

      expect(result).toEqual({ version: '1.2.0', url: 'https://x/bundle.zip', checksum: 'abc', minNativeVersion: '1.0.0', notes: 'fix' });
    });

    it('falls back to the base OS platform when no flavor-specific release exists', async () => {
      repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ version: '1.0.0', bundle_url: 'u', checksum: 'c', min_native_version: null, notes: null });

      const result = await service.getLatest('android-direct');

      expect(repo.findOne).toHaveBeenCalledTimes(2);
      expect(result?.version).toBe('1.0.0');
    });

    it('returns null when neither the flavor nor the base platform has an active release', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.getLatest('android-direct');

      expect(result).toBeNull();
    });

    it('does not double-query for a bare platform with no flavor suffix', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.getLatest('android');

      expect(repo.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('list', () => {
    it('filters by platform when provided', async () => {
      await service.list('android');

      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { platform: 'android' } }));
    });

    it('returns every release when no platform is given', async () => {
      await service.list();

      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });

  describe('create', () => {
    it('uploads the bundle and creates an active release with its checksum', async () => {
      const file = { buffer: Buffer.from('bundle-data'), originalname: 'bundle.zip', mimetype: 'application/zip' };

      const result = await service.create(file, { platform: 'android', version: '2.0.0' });

      expect(sendMock).toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'android', version: '2.0.0', is_active: true, checksum: expect.any(String) }),
      );
      expect(result).toBeDefined();
    });

    it('throws BadRequestException when no file is provided', async () => {
      await expect(service.create(null, { platform: 'android', version: '2.0.0' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no version is provided', async () => {
      const file = { buffer: Buffer.from('x'), originalname: 'b.zip', mimetype: 'application/zip' };

      await expect(service.create(file, { platform: 'android' })).rejects.toThrow(BadRequestException);
    });

    it('defaults platform to "android" when not specified', async () => {
      const file = { buffer: Buffer.from('x'), originalname: 'b.zip', mimetype: 'application/zip' };

      await service.create(file, { platform: '' as any, version: '2.0.0' });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ platform: 'android' }));
    });
  });

  describe('setActive', () => {
    it('updates the release active flag', async () => {
      repo.findOne.mockResolvedValue({ id: 'release-1', is_active: true });

      const result = await service.setActive('release-1', false);

      expect(result.is_active).toBe(false);
    });

    it('throws NotFoundException when the release does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.setActive('missing', true)).rejects.toThrow(NotFoundException);
    });
  });
});
