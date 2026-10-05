import { describe, it, expect } from 'vitest';
import { webhookFor } from './webhook';

describe('webhookFor', () => {
  it('accepts the n8n resume URL', () => {
    const u = 'https://satiah.app.n8n.cloud/webhook-waiting/40155?signature=abc';
    expect(webhookFor(u)).toEqual({ url: u, secret: null });
  });
  it('refuses anything else', () => {
    expect(webhookFor('http://satiah.app.n8n.cloud/webhook-waiting/1')).toBeNull();
    expect(webhookFor('https://evil.example.com/x')).toBeNull();
    expect(webhookFor('https://satiah.app.n8n.cloud.evil.com/x')).toBeNull();
    expect(webhookFor(undefined)).toBeNull();
    expect(webhookFor(42)).toBeNull();
  });
});
