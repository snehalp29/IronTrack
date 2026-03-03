import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  it('returns parsed data on success', () => {
    const pipe = new ZodValidationPipe(
      z.object({ count: z.coerce.number().int().positive() }),
    );

    expect(pipe.transform({ count: '2' })).toEqual({ count: 2 });
  });

  it('throws structured validation error on parse failure', () => {
    const pipe = new ZodValidationPipe(
      z.object({ count: z.number().int().positive() }),
    );

    expect(() => pipe.transform({ count: 0 })).toThrow(BadRequestException);

    try {
      pipe.transform({ count: 0 });
      fail('expected validation to throw');
    } catch (error) {
      const payload = (error as BadRequestException).getResponse() as {
        code: string;
        message: string;
        details: Array<{ path: string; message: string }>;
      };

      expect(payload).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [
          {
            path: 'count',
            message: 'Too small: expected number to be >0',
          },
        ],
      });
    }
  });
});
