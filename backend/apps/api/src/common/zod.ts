import { applyDecorators, BadRequestException, PipeTransform } from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { z } from 'zod';

/** Validates (and coerces/defaults) a request part with a Zod schema from @msma/shared. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}

/** Zod schema → OpenAPI 3.0 schema object for Swagger. */
export function openApiSchema(schema: z.ZodType, io: 'input' | 'output' = 'output'): SchemaObject {
  return z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io,
    unrepresentable: 'any',
  }) as SchemaObject;
}

export const ApiZodBody = (schema: z.ZodType) =>
  ApiBody({ schema: openApiSchema(schema, 'input') });

export const ApiZodResponse = (schema: z.ZodType, status = 200, description?: string) =>
  ApiResponse({ status, schema: openApiSchema(schema), description });

/** Documents every property of a Zod object schema as a query parameter. */
export function ApiZodQuery(schema: z.ZodObject) {
  const json = openApiSchema(schema, 'input');
  const required = new Set(json.required ?? []);
  return applyDecorators(
    ...Object.entries(json.properties ?? {}).map(([name, prop]) =>
      ApiQuery({ name, required: required.has(name), schema: prop as SchemaObject }),
    ),
  );
}
