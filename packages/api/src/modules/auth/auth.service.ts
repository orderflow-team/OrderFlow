import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async signup(email: string, password: string, businessId: string) {
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // TODO: Save to database in Week 2
    return {
      message: 'User signup successful',
      userId: 'temp-user-id',
    };
  }

  async login(email: string, password: string) {
    // TODO: Verify against database in Week 2
    const payload = {
      sub: 'user-id',
      email: email,
      businessId: 'business-id',
      role: 'admin',
    };

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '24h' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }
}
