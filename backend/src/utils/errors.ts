import { GraphQLError } from 'graphql';

export function NotFoundError(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'NOT_FOUND' } });
}

export function UnauthorizedError(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'UNAUTHORIZED' } });
}

export function ForbiddenError(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'FORBIDDEN' } });
}

export function ValidationError(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'VALIDATION_ERROR' } });
}
