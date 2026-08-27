import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            signup: jest.fn(),
            login: jest.fn(),
            refresh: jest.fn(),
            requestOtp: jest.fn(),
            verifyOtp: jest.fn(),
            requestPasswordReset: jest.fn(),
            resetPassword: jest.fn(),
            changePassword: jest.fn(),
            tableGuestLogin: jest.fn(),
            takeawayGuestLogin: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    service = module.get(AuthService);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('signup delegates to AuthService.signup', async () => {
    const dto = { email: 'a@b.com', password: 'password123' } as any;
    (service.signup as jest.Mock).mockResolvedValue({ access_token: 'x' });

    const result = await controller.signup(dto);

    expect(service.signup).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ access_token: 'x' });
  });

  it('login delegates to AuthService.login', async () => {
    const dto = { email: 'a@b.com', password: 'password123' } as any;
    (service.login as jest.Mock).mockResolvedValue({ access_token: 'y' });

    const result = await controller.login(dto);

    expect(service.login).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ access_token: 'y' });
  });

  it('refresh delegates to AuthService.refresh', async () => {
    const dto = { refreshToken: 'r' } as any;
    (service.refresh as jest.Mock).mockResolvedValue({ access_token: 'z' });

    const result = await controller.refresh(dto);

    expect(service.refresh).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ access_token: 'z' });
  });

  it('requestOtp delegates to AuthService.requestOtp', async () => {
    const dto = { email: 'a@b.com' } as any;
    (service.requestOtp as jest.Mock).mockResolvedValue({ message: 'OTP sent' });

    const result = await controller.requestOtp(dto);

    expect(service.requestOtp).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ message: 'OTP sent' });
  });

  it('verifyOtp delegates to AuthService.verifyOtp', async () => {
    const dto = { email: 'a@b.com', code: '123456' } as any;
    (service.verifyOtp as jest.Mock).mockResolvedValue({ access_token: 'w' });

    const result = await controller.verifyOtp(dto);

    expect(service.verifyOtp).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ access_token: 'w' });
  });

  it('requestPasswordReset delegates to AuthService.requestPasswordReset', async () => {
    const dto = { email: 'a@b.com' } as any;
    (service.requestPasswordReset as jest.Mock).mockResolvedValue({ message: 'ok' });

    const result = await controller.requestPasswordReset(dto);

    expect(service.requestPasswordReset).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ message: 'ok' });
  });

  it('resetPassword delegates to AuthService.resetPassword', async () => {
    const dto = { email: 'a@b.com', code: '123456', newPassword: 'newpass1' } as any;
    (service.resetPassword as jest.Mock).mockResolvedValue({ access_token: 'v' });

    const result = await controller.resetPassword(dto);

    expect(service.resetPassword).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ access_token: 'v' });
  });

  it('changePassword uses req.user.userId and delegates to AuthService.changePassword', async () => {
    const dto = { currentPassword: 'old', newPassword: 'newpass1' } as any;
    const req = { user: { userId: 'user-1' } };
    (service.changePassword as jest.Mock).mockResolvedValue({ message: 'Password updated' });

    const result = await controller.changePassword(req, dto);

    expect(service.changePassword).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual({ message: 'Password updated' });
  });

  it('tableGuestLogin delegates to AuthService.tableGuestLogin with the tableId body field', async () => {
    (service.tableGuestLogin as jest.Mock).mockResolvedValue({ access_token: 'guest' });

    const result = await controller.tableGuestLogin('table-1');

    expect(service.tableGuestLogin).toHaveBeenCalledWith('table-1');
    expect(result).toEqual({ access_token: 'guest' });
  });

  it('takeawayGuestLogin delegates to AuthService.takeawayGuestLogin with the businessId body field', async () => {
    (service.takeawayGuestLogin as jest.Mock).mockResolvedValue({ access_token: 'guest2' });

    const result = await controller.takeawayGuestLogin('biz-1');

    expect(service.takeawayGuestLogin).toHaveBeenCalledWith('biz-1');
    expect(result).toEqual({ access_token: 'guest2' });
  });
});
