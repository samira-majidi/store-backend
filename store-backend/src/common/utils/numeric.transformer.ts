import { ValueTransformer } from 'typeorm';

export class ColumnNumericTransformer implements ValueTransformer {
  to(data: number | null): number | null {
    if (data === null || data === undefined) return null;
    return data;
  }

  from(data: string | null): number | null {
    if (data === null || data === undefined) return null;

    return parseInt(data, 10);
  }
}
