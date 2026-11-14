import { publicApiRequest } from './auth-client';

// Share only simultaneous public GETs. Completed responses/errors are never cached.
// Private reads and all mutations keep the original request path and auth checks.
const pending = new Map<string, Promise<unknown>>();
export function publicRead<T>(path: string): Promise<T> {
  const pathname = path.split('?')[0];
  if (!/^\/api\/v1\/(job-catalog|jobs(?:\/[1-9][0-9]*)?|companies(?:\/filters|\/[1-9][0-9]*(?:\/jobs)?)?)$/.test(pathname)) {
    return Promise.reject(new Error('Unsupported public read'));
  }
  const current = pending.get(path);
  if (current) return current as Promise<T>;
  const request = publicApiRequest<T>(path);
  pending.set(path, request);
  const release = () => { if (pending.get(path) === request) pending.delete(path); };
  void request.then(release, release);
  return request;
}
