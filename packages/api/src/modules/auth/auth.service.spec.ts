import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { MailService } from './mail.service';
import { User } from '../../database/entities/user.entity';
import { OtpCode } from '../../database/entities/otp-code.entity';
import { PlatformSetting } from '../../database/entities/platform-setting.entity';
import { UserRole } from '../../common/enums/user-role.enum';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

type MockRepo<T = any> = {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  createQueryBuilder: jest.Mock;
};

const createMockRepo = (): MockRepo => ({
  findOne: jest.fn(),
  create: jest.fn((entity) => ({ is_active: true, ...entity })),
  save: jest.fn(async (entity) => entity),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const buildQueryBuilder = (getOneResult: any) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(getOneResult),
});

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: MockRepo;
  let otpRepo: MockRepo;
  let platformSettingRepo: MockRepo;
  let jwtService: jest.Mocked<JwtService>;
  let mailService: jest.Mocked<MailService>;
  let dataSource: { query: jest.Mock; getRepository: jest.Mock };

  const baseUser: Partial<User> = {
    id: 'user-1',
    email: 'user@example.com',
    password_hash: 'hashed-password',
    full_name: 'Test User',
    business_id: 'biz-1',
    role: UserRole.ADMIN,
    is_active: true,
  };

  beforeEach(async () => {
    usersRepo = createMockRepo();
    otpRepo = createMockRepo();
    platformSettingRepo = createMockRepo();
    dataSource = { query: jest.fn().mockResolvedValue(undefined), getRepository: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(OtpCode), useValue: otpRepo },
        { provide: getRepositoryToken(PlatformSetting), useValue: platformSettingRepo },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('signed-token'), verify: jest.fn() } },
        {
          provide: MailService,
          useValue: { sendOtpEmail: jest.fn().mockResolvedValue(true), sendPasswordResetEmail: jest.fn().mockResolvedValue(true) },
        },
        { provide: require('typeorm').DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(AuthService);
    jwtService = module.get(JwtService);
    mailService = module.get(MailService);
    platformSettingRepo.find.mockResolvedValue([]);

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    jest.spyOn(Math, 'random').mockReturnValue(0.123456);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('creates a new user and issues tokens when email is not taken', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      const result = await service.signup({
        email: 'New@Example.com',
        password: 'password123',
        fullName: 'New User',
        businessId: 'biz-2',
      });

      expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { email: expect.anything() } });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(usersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com', role: UserRole.ADMIN, business_id: 'biz-2' }),
      );
      expect(usersRepo.save).toHaveBeenCalled();
      expect(result.access_token).toBe('signed-token');
      expect(result.refresh_token).toBe('signed-token');
      expect(result.user.email).toBe('new@example.com');
    });

    it('throws ConflictException when the email is already registered', async () => {
      usersRepo.findOne.mockResolvedValue(baseUser);

      await expect(
        service.signup({ email: 'user@example.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
      expect(usersRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('logs in successfully with correct credentials and logs activity', async () => {
      usersRepo.findOne.mockResolvedValue({ ...baseUser });

      const result = await service.login({ email: 'user@example.com', password: 'correct' });

      expect(bcrypt.compare).toHaveBeenCalledWith('correct', 'hashed-password');
      expect(dataSource.query).toHaveBeenCalled();
      expect(result.access_token).toBe('signed-token');
      expect(result.user.id).toBe('user-1');
    });

    it('throws UnauthorizedException when the user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.login({ email: 'nobody@example.com', password: 'x' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the user has no password hash (OTP-only account)', async () => {
      usersRepo.findOne.mockResolvedValue({ ...baseUser, password_hash: null });

      await expect(service.login({ email: 'user@example.com', password: 'x' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      usersRepo.findOne.mockResolvedValue({ ...baseUser });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'user@example.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the account is disabled', async () => {
      usersRepo.findOne.mockResolvedValue({ ...baseUser, is_active: false });

      await expect(service.login({ email: 'user@example.com', password: 'correct' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ServiceUnavailableException when maintenance mode is on for a non-super-admin', async () => {
      usersRepo.findOne.mockResolvedValue({ ...baseUser, role: UserRole.MANAGER });
      platformSettingRepo.find.mockResolvedValue([{ maintenance_mode: true, maintenance_message: 'Down for maintenance' }]);

      await expect(service.login({ email: 'user@example.com', password: 'correct' })).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('allows SUPER_ADMIN to log in even during maintenance mode', async () => {
      usersRepo.findOne.mockResolvedValue({ ...baseUser, role: UserRole.SUPER_ADMIN });
      platformSettingRepo.find.mockResolvedValue([{ maintenance_mode: true, maintenance_message: 'Down' }]);

      const result = await service.login({ email: 'user@example.com', password: 'correct' });
      expect(result.access_token).toBe('signed-token');
    });

    it('normalizes email casing and trims whitespace before lookup', async () => {
      usersRepo.findOne.mockResolvedValue({ ...baseUser });

      await service.login({ email: '  User@Example.com  ', password: 'correct' });

      expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { email: expect.anything() } });
    });
  });

  describe('reissueTokensForUser', () => {
    it('reissues tokens for an existing user', async () => {
      usersRepo.findOne.mockResolvedValue({ ...baseUser });

      const result = await service.reissueTokensForUser('user-1');

      expect(result.access_token).toBe('signed-token');
    });

    it('throws NotFoundException when the user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.reissueTokensForUser('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('refresh', () => {
    it('issues new tokens for a valid refresh token belonging to a real, active user', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-1',
        email: 'user@example.com',
        businessId: 'biz-1',
        role: UserRole.ADMIN,
      });
      usersRepo.findOne.mockResolvedValue({ ...baseUser });

      const result = await service.refresh({ refreshToken: 'valid-token' });

      expect(result.access_token).toBe('signed-token');
    });

    it('throws UnauthorizedException when the token fails verification', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('bad token');
      });

      await expect(service.refresh({ refreshToken: 'garbage' })).rejects.toThrow(UnauthorizedException);
    });

    it('reissues a guest session directly without a database lookup', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'guest-takeaway-biz-1',
        email: 'guest-takeaway@orderflow.guest',
        businessId: 'biz-1',
        role: UserRole.GUEST,
      });

      const result = await service.refresh({ refreshToken: 'guest-token' });

      expect(usersRepo.findOne).not.toHaveBeenCalled();
      expect(result.user.role).toBe(UserRole.GUEST);
    });

    it('throws UnauthorizedException when the user from the token no longer exists', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-1',
        email: 'user@example.com',
        businessId: 'biz-1',
        role: UserRole.ADMIN,
      });
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.refresh({ refreshToken: 'valid-token' })).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the user is disabled', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-1',
        email: 'user@example.com',
        businessId: 'biz-1',
        role: UserRole.ADMIN,
      });
      usersRepo.findOne.mockResolvedValue({ ...baseUser, is_active: false });

      await expect(service.refresh({ refreshToken: 'valid-token' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('requestOtp', () => {
    it('generates and stores a new OTP, then emails it', async () => {
      otpRepo.createQueryBuilder.mockReturnValue(buildQueryBuilder(null));

      const result = await service.requestOtp({ email: 'user@example.com' });

      expect(otpRepo.save).toHaveBeenCalled();
      expect(mailService.sendOtpEmail).toHaveBeenCalledWith('user@example.com', expect.any(String));
      expect(result.message).toBe('OTP sent');
      expect(result).not.toHaveProperty('devCode');
    });

    it('throws BadRequestException when a code was requested within the cooldown window', async () => {
      otpRepo.createQueryBuilder.mockReturnValue(buildQueryBuilder({ id: 'otp-1' }));

      await expect(service.requestOtp({ email: 'user@example.com' })).rejects.toThrow(BadRequestException);
      expect(otpRepo.save).not.toHaveBeenCalled();
    });

    it('does not leak devCode when ALLOW_OTP_DEV_BYPASS is unset even if email send fails', async () => {
      otpRepo.createQueryBuilder.mockReturnValue(buildQueryBuilder(null));
      mailService.sendOtpEmail = jest.fn().mockResolvedValue(false);

      const result = await service.requestOtp({ email: 'user@example.com' });

      expect(result).not.toHaveProperty('devCode');
    });
  });

  describe('verifyOtp', () => {
    const validOtp = () => ({
      id: 'otp-1',
      email: 'user@example.com',
      code: '123456',
      purpose: 'login',
      consumed: false,
      attempts: 0,
      expires_at: new Date(Date.now() + 60_000),
    });

    it('logs in an existing user with a valid code', async () => {
      otpRepo.findOne.mockResolvedValue(validOtp());
      usersRepo.findOne.mockResolvedValue({ ...baseUser });

      const result = await service.verifyOtp({ email: 'user@example.com', code: '123456' });

      expect(otpRepo.save).toHaveBeenCalledWith(expect.objectContaining({ consumed: true }));
      expect(result.access_token).toBe('signed-token');
    });

    it('creates a new passwordless user when none exists yet', async () => {
      otpRepo.findOne.mockResolvedValue(validOtp());
      usersRepo.findOne.mockResolvedValue(null);

      const result = await service.verifyOtp({ email: 'new@example.com', code: '123456' });

      expect(usersRepo.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.com', role: UserRole.ADMIN }));
      expect(result.access_token).toBe('signed-token');
    });

    it('throws BadRequestException when there is no outstanding OTP', async () => {
      otpRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyOtp({ email: 'user@example.com', code: '123456' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the OTP has expired', async () => {
      otpRepo.findOne.mockResolvedValue({ ...validOtp(), expires_at: new Date(Date.now() - 1000) });

      await expect(service.verifyOtp({ email: 'user@example.com', code: '123456' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException and does not consume attempts further once max attempts reached', async () => {
      otpRepo.findOne.mockResolvedValue({ ...validOtp(), attempts: 5 });

      await expect(service.verifyOtp({ email: 'user@example.com', code: '123456' })).rejects.toThrow(
        BadRequestException,
      );
      expect(otpRepo.save).not.toHaveBeenCalled();
    });

    it('increments attempts and throws when the code is incorrect', async () => {
      const otp = validOtp();
      otpRepo.findOne.mockResolvedValue(otp);

      await expect(service.verifyOtp({ email: 'user@example.com', code: '000000' })).rejects.toThrow(
        BadRequestException,
      );
      expect(otpRepo.save).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1 }));
    });

    it('throws UnauthorizedException when the resolved user is disabled', async () => {
      otpRepo.findOne.mockResolvedValue(validOtp());
      usersRepo.findOne.mockResolvedValue({ ...baseUser, is_active: false });

      await expect(service.verifyOtp({ email: 'user@example.com', code: '123456' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('respects maintenance mode for non-super-admin users', async () => {
      otpRepo.findOne.mockResolvedValue(validOtp());
      usersRepo.findOne.mockResolvedValue({ ...baseUser, role: UserRole.MANAGER });
      platformSettingRepo.find.mockResolvedValue([{ maintenance_mode: true, maintenance_message: null }]);

      await expect(service.verifyOtp({ email: 'user@example.com', code: '123456' })).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('requestPasswordReset', () => {
    it('returns the generic response without sending anything when the user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      const result = await service.requestPasswordReset({ email: 'nobody@example.com' });

      expect(result.message).toMatch(/if an account exists/i);
      expect(otpRepo.save).not.toHaveBeenCalled();
    });

    it('returns the generic response (without a new send) when a code was requested recently', async () => {
      usersRepo.findOne.mockResolvedValue({ ...baseUser });
      otpRepo.createQueryBuilder.mockReturnValue(buildQueryBuilder({ id: 'existing-otp' }));

      const result = await service.requestPasswordReset({ email: 'user@example.com' });

      expect(result.message).toMatch(/if an account exists/i);
      expect(otpRepo.save).not.toHaveBeenCalled();
    });

    it('generates and emails a reset code for an existing user', async () => {
      usersRepo.findOne.mockResolvedValue({ ...baseUser });
      otpRepo.createQueryBuilder.mockReturnValue(buildQueryBuilder(null));

      const result = await service.requestPasswordReset({ email: 'user@example.com' });

      expect(otpRepo.save).toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith('user@example.com', expect.any(String));
      expect(result.message).toMatch(/if an account exists/i);
    });
  });

  describe('resetPassword', () => {
    const validOtp = () => ({
      id: 'otp-1',
      email: 'user@example.com',
      code: '654321',
      purpose: 'password_reset',
      consumed: false,
      attempts: 0,
      expires_at: new Date(Date.now() + 60_000),
    });

    it('resets the password and logs the user in with a valid code', async () => {
      otpRepo.findOne.mockResolvedValue(validOtp());
      usersRepo.findOne.mockResolvedValue({ ...baseUser });

      const result = await service.resetPassword({ email: 'user@example.com', code: '654321', newPassword: 'newpass123' });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpass123', 10);
      expect(usersRepo.save).toHaveBeenCalled();
      expect(result.access_token).toBe('signed-token');
    });

    it('throws BadRequestException when the code is missing/expired', async () => {
      otpRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword({ email: 'user@example.com', code: '654321', newPassword: 'newpass123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on an incorrect code and records the attempt', async () => {
      otpRepo.findOne.mockResolvedValue(validOtp());

      await expect(
        service.resetPassword({ email: 'user@example.com', code: '000000', newPassword: 'newpass123' }),
      ).rejects.toThrow(BadRequestException);
      expect(otpRepo.save).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1 }));
    });

    it('throws NotFoundException when the user no longer exists', async () => {
      otpRepo.findOne.mockResolvedValue(validOtp());
      usersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword({ email: 'user@example.com', code: '654321', newPassword: 'newpass123' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('changePassword', () => {
    it('changes the password when the current password matches', async () => {
      usersRepo.findOne.mockResolvedValue({ ...baseUser });

      const result = await service.changePassword('user-1', { currentPassword: 'old', newPassword: 'newpass123' });

      expect(bcrypt.compare).toHaveBeenCalledWith('old', 'hashed-password');
      expect(bcrypt.hash).toHaveBeenCalledWith('newpass123', 10);
      expect(result.message).toBe('Password updated');
    });

    it('sets a password for the first time when the account has none, without requiring currentPassword', async () => {
      usersRepo.findOne.mockResolvedValue({ ...baseUser, password_hash: null });

      const result = await service.changePassword('user-1', { newPassword: 'newpass123' } as any);

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(result.message).toBe('Password updated');
    });

    it('throws NotFoundException when the user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.changePassword('missing', { newPassword: 'newpass123' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when currentPassword is required but missing', async () => {
      usersRepo.findOne.mockResolvedValue({ ...baseUser });

      await expect(service.changePassword('user-1', { newPassword: 'newpass123' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws UnauthorizedException when currentPassword does not match', async () => {
      usersRepo.findOne.mockResolvedValue({ ...baseUser });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', { currentPassword: 'wrong', newPassword: 'newpass123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('tableGuestLogin', () => {
    it('issues guest tokens for an existing table', async () => {
      dataSource.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ id: 'table-1', name: 'Table 5', business_id: 'biz-1' }),
      });

      const result = await service.tableGuestLogin('table-1');

      expect(result.user.role).toBe(UserRole.GUEST);
      expect(result.user.id).toBe('guest-table-1');
    });

    it('throws NotFoundException when the table does not exist', async () => {
      dataSource.getRepository.mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) });

      await expect(service.tableGuestLogin('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('takeawayGuestLogin', () => {
    it('issues guest tokens for an existing business', async () => {
      dataSource.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ id: 'biz-1', name: 'My Biz' }),
      });

      const result = await service.takeawayGuestLogin('biz-1');

      expect(result.user.role).toBe(UserRole.GUEST);
      expect(result.user.id).toBe('guest-takeaway-biz-1');
    });

    it('throws NotFoundException when the business does not exist', async () => {
      dataSource.getRepository.mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) });

      await expect(service.takeawayGuestLogin('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
