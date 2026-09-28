import { IsString, Length, Matches } from 'class-validator';

export class CreateAppGoogleHandoffDto {
  @Matches(/^[a-f0-9]{64}$/, { message: 'secretHash must be a sha256 hex digest' })
  secretHash: string;
}

export class ClaimAppGoogleHandoffDto {
  @IsString()
  @Length(32, 128)
  secret: string;
}
