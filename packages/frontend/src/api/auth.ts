import { api } from './client.js';
import type { LoginResponse } from '@heartbeat/shared';

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await api.post('/auth/login', { username, password });
  return res.data.data;
}

export async function refreshToken(): Promise<string> {
  const res = await api.post('/auth/refresh');
  return res.data.data.token;
}

export async function getMe() {
  const res = await api.get('/auth/me');
  return res.data.data;
}
