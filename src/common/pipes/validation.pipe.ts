import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export const validationPipeConfig = new ValidationPipe({
  whitelist: true, // Strip properties that don't have decorators
  forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
  transform: true, // Transform payloads to DTO instances
  transformOptions: {
    enableImplicitConversion: true,
  },
  exceptionFactory: (validationErrors: ValidationError[] = []) => {
    const formatErrors = (errors: ValidationError[]): string[] => {
      return errors.reduce((acc, error) => {
        if (error.constraints) {
          acc.push(...Object.values(error.constraints));
        }
        if (error.children && error.children.length > 0) {
          acc.push(...formatErrors(error.children));
        }
        return acc;
      }, [] as string[]);
    };

    const formattedErrors = formatErrors(validationErrors);

    return new BadRequestException({
      message: 'Validation failed',
      errors: formattedErrors,
    });
  },
});
