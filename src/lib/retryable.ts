// Classifies errors from AWS/Remotion calls as transient (worth retrying) vs. permanent.
const RETRYABLE_NAMES = new Set([
  'TooManyRequestsException',
  'ThrottlingException',
  'ThrottledException',
  'ProvisionedThroughputExceededException',
  'RequestLimitExceeded',
  'ServiceUnavailable',
  'ServiceUnavailableException',
  'TimeoutError',
  'RequestTimeout',
]);

const RETRYABLE_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EPIPE']);

const RETRYABLE_MESSAGE =
  /rate exceeded|too ?many ?requests|throttl|econnreset|etimedout|enotfound|eai_again|econnrefused|fetch failed|socket hang up|timed out|network timeout/i;

export function isRetryableAwsError(err: unknown, depth = 0): boolean {
  if (err == null || depth > 3) return false;
  if (typeof err === 'string') return RETRYABLE_MESSAGE.test(err);
  if (typeof err !== 'object') return false;
  const e = err as { name?: unknown; message?: unknown; code?: unknown; cause?: unknown; $metadata?: { httpStatusCode?: unknown } };
  if (typeof e.name === 'string' && RETRYABLE_NAMES.has(e.name)) return true;
  if (typeof e.code === 'string' && RETRYABLE_CODES.has(e.code)) return true;
  const status = e.$metadata?.httpStatusCode;
  if (status === 429 || status === 503) return true;
  if (typeof e.message === 'string' && RETRYABLE_MESSAGE.test(e.message)) return true;
  return e.cause !== undefined ? isRetryableAwsError(e.cause, depth + 1) : false;
}
