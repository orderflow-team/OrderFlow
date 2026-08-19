import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MailService } from './mail.service';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../../database/entities/user.entity';
import { OtpCode } from '../../database/entities/otp-code.entity';
import { PlatformSetting } from '../../database/entities/platform-setting.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, OtpCode, PlatformSetting]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, MailService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
