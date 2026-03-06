import { BadRequestException } from '@nestjs/common';
import { IsEmail, MinLength } from 'class-validator';

import { createAppValidationPipe } from './app-validation.pipe';

class TestCredentialsDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;
}

describe('createAppValidationPipe', () => {
  it('normalizes class-validator failures to the shared validation error shape', async () => {
    const pipe = createAppValidationPipe();

    await expect(
      pipe.transform(
        {
          email: 'not-an-email',
          password: 'short',
        },
        {
          type: 'body',
          metatype: TestCredentialsDto,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    try {
      await pipe.transform(
        {
          email: 'not-an-email',
          password: 'short',
        },
        {
          type: 'body',
          metatype: TestCredentialsDto,
        },
      );
      fail('expected validation error');
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: 'email',
          }),
          expect.objectContaining({
            path: 'password',
          }),
        ]),
      });
    }
  });
});
