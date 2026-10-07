import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Failures caused by what the client SENT (a malformed id, a null byte, a body
 * that is too large, a missing parameter) used to fall through to a generic 500.
 * That told the caller nothing, filled the error log with noise, and made
 * unauthenticated routes look like they crash on demand. These are mapped to the
 * 4xx they really are. The messages are fixed strings: driver text can name
 * tables and columns, so it is never sent to the browser.
 */
const POSTGRES_CLIENT_ERRORS: Record<string, { status: number; message: string }> = {
  '22P02': { status: HttpStatus.BAD_REQUEST, message: 'Invalid identifier or value' }, // e.g. "abc" where a uuid is expected
  '22021': { status: HttpStatus.BAD_REQUEST, message: 'Invalid characters in request' }, // null byte
  '22001': { status: HttpStatus.BAD_REQUEST, message: 'A value is too long' },
  '22003': { status: HttpStatus.BAD_REQUEST, message: 'A number is out of range' },
  '23502': { status: HttpStatus.BAD_REQUEST, message: 'A required value is missing' },
  '23503': { status: HttpStatus.CONFLICT, message: 'This record is still referenced by other data' },
  '23505': { status: HttpStatus.CONFLICT, message: 'A record with these details already exists' },
};

export function classifyClientError(exception: unknown): { status: number; message: string } | null {
  if (exception instanceof HttpException || !(exception instanceof Error)) return null;
  const e = exception as Error & { status?: number; statusCode?: number; expose?: boolean; driverError?: { code?: string }; code?: string };

  // Express/body-parser errors (413 PayloadTooLarge, 400 invalid JSON, ...) are http-errors: they carry their
  // own 4xx status and `expose: true`. Requiring `expose` matters: an upstream failure (e.g. the WhatsApp
  // gateway answering 401 to a service call) also has a `status`, and must NOT be echoed to the browser as a
  // 401, which the web app would read as an expired session.
  const httpStatus = e.status ?? e.statusCode;
  if (e.expose === true && typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus < 500) {
    const message =
      httpStatus === HttpStatus.PAYLOAD_TOO_LARGE
        ? 'Request body is too large'
        : httpStatus === HttpStatus.BAD_REQUEST
          ? 'Malformed request'
          : 'Invalid request';
    return { status: httpStatus, message };
  }

  const pgCode = e.driverError?.code ?? (typeof e.code === 'string' ? e.code : undefined);
  if (pgCode && POSTGRES_CLIENT_ERRORS[pgCode]) return POSTGRES_CLIENT_ERRORS[pgCode];

  // TypeORM refuses `where: { id: undefined }` instead of matching every row. That is
  // the safe outcome, but it surfaces as an error when a required parameter was omitted.
  if (/^Undefined value encountered in property/.test(e.message)) {
    return { status: HttpStatus.BAD_REQUEST, message: 'A required parameter is missing' };
  }
  return null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const clientError = classifyClientError(exception);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : clientError?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : null;

    let message = clientError?.message ?? 'Internal server error';
    let errorDetails: any = null;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      message = (exceptionResponse as any).message || message;
      errorDetails = (exceptionResponse as any).error || null;
    } else if (exception instanceof Error && !clientError) {
      message = status === HttpStatus.INTERNAL_SERVER_ERROR
        ? 'Internal server error'
        : exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - Status ${status}: ${
          exception instanceof Error ? exception.stack : JSON.stringify(exception)
        }`,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(errorDetails && { error: errorDetails }),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
