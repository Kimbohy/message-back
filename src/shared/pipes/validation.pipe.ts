import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export const validationPipeConfig = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
  exceptionFactory: (validationErrors: ValidationError[] = []) => {
    const formatErrors = (errors: ValidationError[]): string[] => {
      return errors.reduce<string[]>((acc, error) => {
        if (error.constraints) {
          acc.push(...Object.values(error.constraints));
        }
        if (error.children && error.children.length > 0) {
          acc.push(...formatErrors(error.children));
        }
        return acc;
      }, []);
    };

    const formattedErrors = formatErrors(validationErrors);

    return new BadRequestException({
      message: 'Validation failed',
      errors: formattedErrors,
    });
  },
});
