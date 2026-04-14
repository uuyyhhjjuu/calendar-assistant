const attempts = new Map<string, number[]>();
const locks = new Map<string, number>();

const MAX_ATTEMPTS = 7;
const WINDOW_MS = 10 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

export function canAttempt(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const until = locks.get(key);
  if (until && now < until) {
    return { allowed: false, retryAfterSec: Math.ceil((until - now) / 1000) };
  }
  return { allowed: true };
}

export function registerFailure(key: string) {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((value) => now - value < WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
  if (recent.length >= MAX_ATTEMPTS) {
    locks.set(key, now + LOCK_MS);
    attempts.delete(key);
  }
}

export function resetAttempts(key: string) {
  attempts.delete(key);
  locks.delete(key);
}