// Shared error-message redaction: first line only, URLs reduced to host, Telegram bot tokens hidden.
export const redactMessage = (message: string): string =>
  message
    .split('\n')[0]
    .replace(/https?:\/\/(?:[^\s/@]*@)?([^\s/?#:]+)\S*/g, '<url:$1>')
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot<redacted>')
    .slice(0, 300);
