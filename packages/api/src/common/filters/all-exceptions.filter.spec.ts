import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AllExceptionsFilter, classifyClientError } from './all-exceptions.filter';

const pgError = (code: string, message = 'driver text that names "public.users" and a column') =>
  new QueryFailedError('SELECT 1', [], Object.assign(new Error(message), { code }) as any);

const httpError = (status: number) => Object.assign(new Error('raw library text'), { status, statusCode: status, expose: true });

function run(exception: unknown) {
  const json = jest.fn();
  const response = { status: jest.fn().mockReturnValue({ json }) };
  const host: any = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ method: 'GET', url: '/api/x' }) }),
  };
  new AllExceptionsFilter().catch(exception, host);
  return { status: response.status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
}

describe('AllExceptionsFilter', () => {
  describe('client mistakes become 4xx instead of 500', () => {
    it('maps an invalid uuid/value (22P02) to 400', () => {
      const { status, body } = run(pgError('22P02', 'invalid input syntax for type uuid: "abc"'));
      expect(status).toBe(400);
      expect(body.message).toBe('Invalid identifier or value');
    });

    it('maps a null byte (22021) to 400', () => {
      expect(run(pgError('22021')).status).toBe(400);
    });

    it('maps out-of-range / too-long / missing-required values to 400', () => {
      expect(run(pgError('22003')).status).toBe(400);
      expect(run(pgError('22001')).status).toBe(400);
      expect(run(pgError('23502')).status).toBe(400);
    });

    it('maps foreign-key and unique violations to 409', () => {
      expect(run(pgError('23503')).status).toBe(409);
      expect(run(pgError('23505')).status).toBe(409);
    });

    it('maps a body-parser 413 to 413 instead of 500', () => {
      const { status, body } = run(httpError(413));
      expect(status).toBe(413);
      expect(body.message).toBe('Request body is too large');
    });

    it('maps malformed JSON (400) to 400', () => {
      expect(run(httpError(400)).status).toBe(400);
    });

    it('maps TypeORM\'s refusal of an undefined where-value (omitted parameter) to 400', () => {
      const err = new Error("Undefined value encountered in property 'Product.business_id' of a where condition. Set 'invalidWhereValuesBehavior' ...");
      const { status, body } = run(err);
      expect(status).toBe(400);
      expect(body.message).toBe('A required parameter is missing');
    });
  });

  describe('real server problems stay 500', () => {
    it('keeps an unknown database error as a generic 500 and hides the driver text', () => {
      const { status, body } = run(pgError('XX000', 'relation "secret_table" does not exist'));
      expect(status).toBe(500);
      expect(JSON.stringify(body)).not.toContain('secret_table');
      expect(body.message).toBe('Internal server error');
    });

    it('keeps a plain Error as a generic 500', () => {
      const { status, body } = run(new Error('boom: /var/www/secret/path'));
      expect(status).toBe(500);
      expect(body.message).toBe('Internal server error');
    });

    it('does NOT echo an upstream 401 to the browser (that would log the user out)', () => {
      const upstream = Object.assign(new Error('Request failed with status code 401'), { status: 401, code: 'ERR_BAD_REQUEST' });
      expect(run(upstream).status).toBe(500);
    });

    it('does not treat a Node network error as a client mistake', () => {
      expect(run(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })).status).toBe(500);
    });

    it('does not leak driver text for the mapped cases either', () => {
      expect(JSON.stringify(run(pgError('23503', 'violates foreign key constraint "FK_secret" on table "payments"')).body)).not.toContain('FK_secret');
    });
  });

  describe('existing behaviour is unchanged', () => {
    it('passes Nest HttpExceptions through with their own status and message', () => {
      const { status, body } = run(new NotFoundException('Order not found'));
      expect(status).toBe(404);
      expect(body.message).toBe('Order not found');
    });

    it('keeps validation messages (array) from BadRequestException', () => {
      const { status, body } = run(new BadRequestException(['email must be an email']));
      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual(['email must be an email']);
    });

    it('classifyClientError ignores HttpException and non-errors', () => {
      expect(classifyClientError(new NotFoundException())).toBeNull();
      expect(classifyClientError('a string')).toBeNull();
      expect(classifyClientError(undefined)).toBeNull();
    });
  });
});
