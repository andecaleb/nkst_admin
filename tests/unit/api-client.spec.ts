import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, ApiError, tokenStorage } from '@/lib/api-client';

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api-client (JSON:API 1.1 & Token Refresh)', () => {
  beforeEach(() => {
    tokenStorage.clear();
  });

  it('unwraps JSON:API 1.1 data and meta on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockJsonResponse({
        jsonapi: { version: '1.1' },
        data: [{ id: 'p1', title: 'Elders' }],
        meta: { total: 1, page: 1, limit: 20 },
      }),
    );

    const res = await api.get<Array<{ id: string; title: string }>>('/hq/positions');
    expect(res.data).toEqual([{ id: 'p1', title: 'Elders' }]);
    expect(res.meta?.total).toBe(1);
  });

  it('normalizes JSON:API 1.1 errors[].detail into ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockJsonResponse(
        {
          jsonapi: { version: '1.1' },
          errors: [
            {
              status: '409',
              title: 'Conflict',
              detail: 'A position titled "Senior Pastor" already exists',
            },
          ],
        },
        409,
      ),
    );

    await expect(api.post('/hq/positions', { title: 'senior pastor' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      message: 'A position titled "Senior Pastor" already exists',
    });
  });

  it('retries once after refreshing accessToken on 401 Unauthorized', async () => {
    tokenStorage.setTokens('expired-access', 'valid-refresh');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        mockJsonResponse({ errors: [{ status: '401', detail: 'Token expired' }] }, 401),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          jsonapi: { version: '1.1' },
          data: { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' },
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          jsonapi: { version: '1.1' },
          data: { id: 'member-1' },
        }),
      );

    const res = await api.get<{ id: string }>('/members/me');
    expect(res.data).toEqual({ id: 'member-1' });
    expect(tokenStorage.getAccessToken()).toBe('fresh-access');
    expect(tokenStorage.getRefreshToken()).toBe('fresh-refresh');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('clears stored tokens and throws ApiError when refresh fails', async () => {
    tokenStorage.setTokens('expired-access', 'bad-refresh');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        mockJsonResponse({ errors: [{ status: '401', detail: 'Unauthorized' }] }, 401),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({ errors: [{ status: '401', detail: 'Invalid refresh' }] }, 401),
      );

    await expect(api.get('/members/me')).rejects.toBeInstanceOf(ApiError);
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });
});
