import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, unwrap } from './index';

/** Like Expo's fetch on phones: a working response object that is NOT `instanceof` the global Response. */
class ForeignResponse {
  readonly ok: boolean;
  readonly headers = new Headers({ 'content-type': 'application/json' });
  constructor(
    readonly status: number,
    private readonly body: unknown,
  ) {
    this.ok = status >= 200 && status < 300;
  }
  async json() {
    return this.body;
  }
  async text() {
    return JSON.stringify(this.body);
  }
  clone() {
    return this;
  }
}

function client(status: number, body: unknown, onUnauthorized = vi.fn()) {
  const seen: Request[] = [];
  const api = createApiClient({
    baseUrl: 'http://api.test',
    getToken: () => 'tok',
    onUnauthorized,
    fetch: async (req) => {
      seen.push(req);
      return new ForeignResponse(status, body) as unknown as Response;
    },
  });
  return { api, seen, onUnauthorized };
}

describe('createApiClient', () => {
  it('works with a fetch whose Response is a different class (Expo on phones)', async () => {
    const { api, seen } = client(200, { status: 'ok' });
    const data = await unwrap(api.GET('/health' as never));
    expect(data).toEqual({ status: 'ok' });
    expect(seen[0].headers.get('Authorization')).toBe('Bearer tok');
  });

  it('calls onUnauthorized on 401 and throws the server message', async () => {
    const { api, onUnauthorized } = client(401, { message: 'Please sign in again' });
    await expect(unwrap(api.GET('/me' as never))).rejects.toThrow(
      new ApiError('Please sign in again', 401),
    );
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});

describe('unwrap', () => {
  it('says "Cannot reach the server" only for network failures', async () => {
    await expect(unwrap(Promise.reject(new TypeError('Network request failed')))).rejects.toThrow(
      /^Cannot reach the server \(Network request failed\)/,
    );
    await expect(unwrap(Promise.reject(new Error('bad state')))).rejects.toThrow(
      /^Something went wrong in the app \(bad state\)/,
    );
  });
});
