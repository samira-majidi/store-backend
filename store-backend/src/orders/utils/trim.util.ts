import { TransformFnParams } from 'class-transformer';

export const trimString = ({ value }: TransformFnParams): unknown => {
  return typeof value === 'string' ? value.trim() : value;
};
