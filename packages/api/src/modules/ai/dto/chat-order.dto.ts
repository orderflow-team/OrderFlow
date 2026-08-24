import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length, ValidateNested } from 'class-validator';

// pendingCustomer is never typed by the caller directly — it's the server's
// own prior reply (parseChatOrder's pendingCustomer field), echoed back
// verbatim by the frontend on the next message (see order-parser.service.ts's
// extractContactInfo doc comment). Still validated like any other client
// input since nothing stops a caller from sending an arbitrary body.
class PendingCustomerDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  customerName?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  phone?: string | null;
}

export class ChatOrderDto {
  @IsUUID()
  businessId: string;

  // No realistic chat order needs anywhere near this many characters —
  // capped mainly so a hostile/misbehaving client can't force the regex-heavy
  // deterministic parser (order-parser.service.ts) to chew through an
  // arbitrarily large string on every request.
  @IsString()
  @Length(1, 2000)
  message: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PendingCustomerDto)
  pendingCustomer?: PendingCustomerDto;
}
