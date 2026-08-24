import { IsString, IsUUID, Length } from 'class-validator';

export class ParseVoiceDto {
  // Same reasoning as ChatOrderDto's message cap — bounds the Gemini prompt
  // (extractOrderStructure in order-parser.service.ts) and the regex-based
  // JSON extraction that follows it to a sane input size.
  @IsString()
  @Length(1, 2000)
  transcript: string;

  @IsUUID()
  customerId: string;
}
