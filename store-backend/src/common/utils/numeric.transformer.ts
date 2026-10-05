import { ValueTransformer } from 'typeorm';

export class ColumnNumericTransformer implements ValueTransformer {
  to(value?: number | null): number | null | undefined {
    if (value === undefined || value === null) {
      return value;
    }

    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(
        `Monetary value must be a non-negative safe integer. Received: ${value}`,
      );
    }

    return value;
  }

  from(value?: string | number | null): number | null | undefined {
    if (value === undefined || value === null) {
      return value;
    }

    const parsedValue = typeof value === 'number' ? value : Number(value);

    if (!Number.isSafeInteger(parsedValue) || parsedValue < 0) {
      throw new Error(`Invalid monetary database value: ${String(value)}`);
    }

    return parsedValue;
  }
}
