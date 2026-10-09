import { clsx, type ClassValue } from 'clsx';
import { flushSync } from 'react-dom';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Cross-fades the page from its old look to the new one (theme, layout) where the browser
// supports View Transitions; elsewhere, or with reduced motion, the change is instant.
export const withViewTransition = (
  update: () => void,
  direction?: 'up' | 'down',
) => {
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  if (!('startViewTransition' in document) || reduceMotion) {
    update();
    return;
  }
  const root = document.documentElement;
  if (direction) root.dataset.vt = direction;
  const transition = document.startViewTransition(() => flushSync(update));
  void transition.finished.finally(() => {
    delete root.dataset.vt;
  });
};

export const stripTrailingSlash = (url: string) => url.replace(/\/+$/, '');

export function getBaseUrl(publicBaseUrl?: string): string {
  if (publicBaseUrl && publicBaseUrl.length > 0) {
    return `${stripTrailingSlash(publicBaseUrl)}/jelliodirect`;
  }
  const match = /.*?\/jelliodirect/.exec(window.location.href);
  if (!match) {
    throw new Error('URL must include /jelliodirect');
  }
  return match[0];
}

export function getOrCreateDeviceId(): string {
  const key = 'jelliodirect_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    // Simple, stable identifier for header metadata
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}
