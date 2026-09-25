import { describe, it, expect } from 'vitest';
import { isRetryableAwsError } from './retryable';

const named = (name: string, message = 'x') => Object.assign(new Error(message), { name });

describe('isRetryableAwsError', () => {
  it.each([
    ['TooManyRequestsException name', named('TooManyRequestsException')],
    ['ThrottlingException name', named('ThrottlingException')],
    ['ThrottledException name', named('ThrottledException')],
    ['ProvisionedThroughputExceededException', named('ProvisionedThroughputExceededException')],
    ['RequestLimitExceeded', named('RequestLimitExceeded')],
    ['ServiceUnavailable name', named('ServiceUnavailable')],
    ['Rate Exceeded message', new Error('Rate exceeded')],
    ['Rate Exceeded (Lambda style)', new Error('Rate Exceeded.')],
    ['TooManyRequestsException in message', new Error('TooManyRequestsException: Rate Exceeded')],
    ['Throttling in message', new Error('ThrottlingException: Rate exceeded')],
    ['ECONNRESET', new Error('read ECONNRESET')],
    ['ETIMEDOUT', new Error('connect ETIMEDOUT 1.2.3.4:443')],
    ['ENOTFOUND', new Error('getaddrinfo ENOTFOUND s3.amazonaws.com')],
    ['EAI_AGAIN', new Error('getaddrinfo EAI_AGAIN lambda.us-east-1.amazonaws.com')],
    ['fetch failed', new TypeError('fetch failed')],
    ['socket hang up', new Error('socket hang up')],
    ['TimeoutError name', named('TimeoutError', 'Connection timed out')],
    ['timed out message', new Error('Request timed out')],
    ['code ECONNRESET', Object.assign(new Error('boom'), { code: 'ECONNRESET' })],
    ['cause chain', Object.assign(new Error('wrapper'), { cause: new Error('read ECONNRESET') })],
    ['HTTP 429 metadata', Object.assign(new Error('x'), { $metadata: { httpStatusCode: 429 } })],
    ['HTTP 503 metadata', Object.assign(new Error('x'), { $metadata: { httpStatusCode: 503 } })],
    ['string thrown', 'Rate Exceeded'],
  ])('retryable: %s', (_l, err) => {
    expect(isRetryableAwsError(err)).toBe(true);
  });

  it.each([
    ['AccessDenied', named('AccessDeniedException', 'User is not authorized')],
    ['ResourceNotFound', named('ResourceNotFoundException', 'Function not found')],
    ['NoSuchBucket', named('NoSuchBucket', 'The specified bucket does not exist')],
    ['TypeError', new TypeError("Cannot read properties of undefined (reading 'x')")],
    ['validation', new Error('Invalid render id')],
    ['HTTP 403 metadata', Object.assign(new Error('x'), { $metadata: { httpStatusCode: 403 } })],
    ['HTTP 500 metadata', Object.assign(new Error('x'), { $metadata: { httpStatusCode: 500 } })],
    ['undefined', undefined],
    ['null', null],
    ['plain object', { foo: 1 }],
    ['empty error', new Error('')],
  ])('not retryable: %s', (_l, err) => {
    expect(isRetryableAwsError(err)).toBe(false);
  });
});
