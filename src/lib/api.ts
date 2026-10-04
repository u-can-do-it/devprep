import type { RawData } from '../../plugins/data-api.ts';
import type { Progress, Question } from './format.ts';

export const isDev = import.meta.env.DEV;

export async function loadRaw(): Promise<RawData> {
  // In dev, read the files live through the dev API so edits show up without a rebuild.
  if (isDev) return request<RawData>('GET', '/__api/data');
  return (await import('./bundled.ts')).default;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `${method} ${url} failed (${res.status})`);
  return data as T;
}

export const saveQuestion = (q: Question) => request<{ id: number }>('POST', '/__api/questions', q);
export const deleteQuestion = (id: number) => request('DELETE', `/__api/questions/${id}`);
export const saveProgressToRepo = (p: Progress) => request('PUT', '/__api/progress', p);
