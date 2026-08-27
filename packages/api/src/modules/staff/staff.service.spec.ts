import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { StaffService } from './staff.service';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';

jest.mock('bcryptjs', () => ({ hash: jest.fn() }));
jest.mock('../../common/utils/credential-crypto.util', () => ({
  encryptPassword: jest.fn((p: string) => `encrypted(${p})`),
  decryptPassword: jest.fn((p: string) => p.replace(/^encrypted\((.*)\)$/, '$1')),
}));

describe('StaffService', () => {
  let service: StaffService;
  let repo: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((entity) => ({ id: 'user-new', is_active: true, ...entity })),
      save: jest.fn(async (entity) => entity),
    };
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    const module: TestingModule = await Test.createTestingModule({
      providers: [StaffService, { provide: getRepositoryToken(User), useValue: repo }],
    }).compile();

    service = module.get(StaffService);
  });

  describe('create', () => {
    it('creates a staff user with hashed and reversibly-encrypted passwords', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.create('biz-1', { email: 'Staff@Example.com', password: 'pass123', name: 'Staff One', role: UserRole.CASHIER } as any);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'staff@example.com', password_hash: 'hashed-password', password_plain: 'encrypted(pass123)' }),
      );
      expect(result).toEqual({ id: 'user-new', email: 'staff@example.com', fullName: 'Staff One', role: UserRole.CASHIER, isActive: true });
    });

    it('throws ConflictException when the email is already registered', async () => {
      repo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(service.create('biz-1', { email: 'a@b.com', password: 'x', name: 'X', role: UserRole.CASHIER } as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('returns staff mapped to the public shape', async () => {
      repo.find.mockResolvedValue([{ id: 'u1', email: 'a@b.com', full_name: 'A', role: UserRole.CASHIER, is_active: true }]);

      const result = await service.findAll('biz-1');

      expect(result).toEqual([{ id: 'u1', email: 'a@b.com', fullName: 'A', role: UserRole.CASHIER, isActive: true }]);
    });
  });

  describe('getCredentials', () => {
    it('decrypts and returns the plaintext password', async () => {
      repo.findOne.mockResolvedValue({ id: 'u1', email: 'a@b.com', password_plain: 'encrypted(pass123)' });

      const result = await service.getCredentials('u1', 'biz-1');

      expect(result).toEqual({ email: 'a@b.com', password: 'pass123' });
    });

    it('returns null password when none is stored', async () => {
      repo.findOne.mockResolvedValue({ id: 'u1', email: 'a@b.com', password_plain: null });

      const result = await service.getCredentials('u1', 'biz-1');

      expect(result.password).toBeNull();
    });

    it('throws NotFoundException when the staff member does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.getCredentials('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates provided fields', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'u1', business_id: 'biz-1', email: 'old@example.com', full_name: 'Old', role: UserRole.CASHIER, is_active: true });

      const result = await service.update('u1', 'biz-1', { name: 'New Name', isActive: false } as any);

      expect(result.fullName).toBe('New Name');
      expect(result.isActive).toBe(false);
    });

    it('normalizes and checks email uniqueness on update, allowing the same user to keep their own email', async () => {
      const user = { id: 'u1', business_id: 'biz-1', email: 'old@example.com', full_name: 'Old', role: UserRole.CASHIER, is_active: true };
      repo.findOne.mockResolvedValueOnce(user).mockResolvedValueOnce(user);

      const result = await service.update('u1', 'biz-1', { email: 'OLD@Example.com' } as any);

      expect(result.email).toBe('old@example.com');
    });

    it('throws ConflictException when updating to an email already used by another user', async () => {
      const user = { id: 'u1', business_id: 'biz-1', email: 'old@example.com', role: UserRole.CASHIER };
      repo.findOne.mockResolvedValueOnce(user).mockResolvedValueOnce({ id: 'other-user' });

      await expect(service.update('u1', 'biz-1', { email: 'taken@example.com' } as any)).rejects.toThrow(ConflictException);
    });

    it('re-hashes and re-encrypts the password when a new one is provided', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'u1', business_id: 'biz-1', email: 'a@b.com', role: UserRole.CASHIER });

      await service.update('u1', 'biz-1', { password: 'newpass' } as any);

      expect(bcrypt.hash).toHaveBeenCalledWith('newpass', 10);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ password_plain: 'encrypted(newpass)' }));
    });

    it('throws NotFoundException when the staff member does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', 'biz-1', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deactivates the staff user rather than deleting the row', async () => {
      repo.findOne.mockResolvedValue({ id: 'u1', business_id: 'biz-1', is_active: true });

      const result = await service.remove('u1', 'biz-1');

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when the staff member does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });
});
