import { convertToEnglishDigits } from '#src/common/utils/persian-number-converter';
import { TransformFnParams } from 'class-transformer';

export function convertDigits({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return convertToEnglishDigits(value);
}
