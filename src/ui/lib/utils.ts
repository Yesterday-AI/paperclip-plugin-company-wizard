import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPluginSettingsUrl(): string {
  // Extract the plugin UUID from the breadcrumb anchor in the Paperclip UI.
  const link = document.querySelector<HTMLAnchorElement>('a[href*="/settings/plugins/"]');
  if (link) {
    const match = link.href.match(/\/settings\/plugins\/([0-9a-f-]+)/);
    if (match) return `/instance/settings/plugins/${match[1]}`;
  }
  return `/instance/settings/plugins`;
}

export function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}
