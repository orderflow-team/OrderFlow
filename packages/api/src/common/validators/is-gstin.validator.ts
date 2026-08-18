import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { isValidGstin } from '../utils/gst.util';

@ValidatorConstraint({ name: 'isGstin', async: false })
class IsGstinConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value !== 'string' || isValidGstin(value);
  }
  defaultMessage(): string {
    return 'Invalid GSTIN — check the 15-character number and try again';
  }
}

/**
 * Validates an optional GSTIN field's format and check-digit — see
 * gst.util.ts's isValidGstin for the algorithm. Pair with @IsOptional():
 * an empty/undefined value always passes here.
 */
export function IsGstin(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsGstinConstraint,
    });
  };
}
