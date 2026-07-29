import { DICTIONARIES, Language } from './dictionaries';

function resolveRaw(language: Language, path: string): unknown {
  const dict = DICTIONARIES[language];
  return path.split('.').reduce<any>((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict);
}

export function resolve(
  language: Language,
  path: string,
  vars?: Record<string, string | number>
): string {
  const raw = resolveRaw(language, path);
  let value = typeof raw === 'string' ? raw : path;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.split(`{{${k}}}`).join(String(v));
    }
  }
  return value;
}

export function resolveArray(language: Language, path: string): string[] {
  const raw = resolveRaw(language, path);
  return Array.isArray(raw) ? (raw as string[]) : [];
}
