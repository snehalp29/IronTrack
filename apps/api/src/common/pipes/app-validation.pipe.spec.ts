import { BadRequestException } from '@nestjs/common';
import { IsEmail, MinLength } from 'class-validator';
import type { ValidationError } from 'class-validator';

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

  it('returns an empty shared validation envelope when exceptionFactory receives no errors', () => {
    const pipe = createAppValidationPipe() as unknown as {
      exceptionFactory: (errors?: ValidationError[]) => BadRequestException;
    };

    expect(pipe.exceptionFactory().getResponse()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [],
    });
  });

  it('flattens nested child validation errors into dotted paths', () => {
    const pipe = createAppValidationPipe() as unknown as {
      exceptionFactory: (errors?: ValidationError[]) => BadRequestException;
    };

    const nestedErrors: ValidationError[] = [
      {
        property: 'profile',
        children: [
          {
            property: 'timezone',
            constraints: {
              isTimeZone: 'timezone must be valid',
            },
            children: [],
          },
        ],
      } as ValidationError,
    ];

    expect(pipe.exceptionFactory(nestedErrors).getResponse()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [
        {
          path: 'profile.timezone',
          message: 'timezone must be valid',
        },
      ],
    });
  });

  it('treats missing child arrays as empty when flattening validation errors', () => {
    const pipe = createAppValidationPipe() as unknown as {
      exceptionFactory: (errors?: ValidationError[]) => BadRequestException;
    };

    const nestedErrors: ValidationError[] = [
      {
        property: 'timezone',
        constraints: {
          isTimeZone: 'timezone must be valid',
        },
      } as ValidationError,
    ];

    expect(pipe.exceptionFactory(nestedErrors).getResponse()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [
        {
          path: 'timezone',
          message: 'timezone must be valid',
        },
      ],
    });
  });
});
