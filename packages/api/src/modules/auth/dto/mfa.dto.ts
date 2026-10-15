import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

/** Either an authenticator code or a recovery code. */
export class MfaProofDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  recoveryCode?: string;
}

export class VerifyMfaLoginDto extends MfaProofDto {
  @IsString()
  @MaxLength(2048)
  mfaToken: string;
}

export class EnableMfaDto {
  @IsString()
  @Length(6, 16)
  code: string;
}
