import { getActiveProvider, getProviderSettings } from './storage';
import { PROVIDER_META, Provider } from './types';
import { translateAsync } from './i18n';

export class AIError extends Error {
  constructor(message: string, public code: 'NO_API_KEY' | 'API_ERROR' | 'NETWORK') {
    super(message);
  }
}

async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new AIError(await translateAsync('errors.network'), 'NETWORK');
  }
}

async function callAnthropic(apiKey: string, model: string, system: string, user: string, maxTokens: number) {
  const res = await safeFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw await apiError(res);
  const data = await res.json();
  return (data?.content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')
    .trim();
}

async function callOpenAI(apiKey: string, model: string, system: string, user: string, maxTokens: number) {
  const res = await safeFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw await apiError(res);
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? '').trim();
}

async function callGoogle(apiKey: string, model: string, system: string, user: string, maxTokens: number) {
  const res = await safeFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );
  if (!res.ok) throw await apiError(res);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p: any) => p.text ?? '')
    .join('\n')
    .trim();
}

async function apiError(res: Response): Promise<AIError> {
  let detail = '';
  try {
    const json = await res.json();
    detail = json?.error?.message ?? JSON.stringify(json);
  } catch {
    detail = await res.text();
  }
  if (res.status === 401 || res.status === 403) {
    return new AIError(await translateAsync('errors.invalidKey'), 'NO_API_KEY');
  }
  return new AIError(await translateAsync('errors.providerError', { status: res.status, detail }), 'API_ERROR');
}

export async function askAI(system: string, user: string, maxTokens = 400): Promise<string> {
  const activeProvider = await getActiveProvider();
  if (activeProvider === 'local') {
    // Callers check the active provider and route to the local coach before ever calling askAI.
    throw new AIError(await translateAsync('errors.noApiKeyGeneric'), 'NO_API_KEY');
  }
  const provider = activeProvider;
  const settings = await getProviderSettings();
  const cfg = settings[provider];

  if (!cfg.apiKey.trim()) {
    const providerLabel = await translateAsync(PROVIDER_META[provider].labelKey);
    throw new AIError(await translateAsync('errors.noApiKey', { provider: providerLabel }), 'NO_API_KEY');
  }

  switch (provider) {
    case 'anthropic':
      return callAnthropic(cfg.apiKey, cfg.model, system, user, maxTokens);
    case 'openai':
      return callOpenAI(cfg.apiKey, cfg.model, system, user, maxTokens);
    case 'google':
      return callGoogle(cfg.apiKey, cfg.model, system, user, maxTokens);
    default: {
      const _exhaustive: never = provider;
      throw new AIError(await translateAsync('errors.unknownProvider'), 'API_ERROR');
    }
  }
}

export async function testProviderConnection(provider: Provider): Promise<string> {
  const settings = await getProviderSettings();
  const cfg = settings[provider];
  if (!cfg.apiKey.trim()) {
    throw new AIError(await translateAsync('errors.noApiKeyGeneric'), 'NO_API_KEY');
  }
  const testSystem = 'Reply with a single word.';
  const testWord = await translateAsync('ai.testWord');
  const testUser = `Say "${testWord}".`;
  switch (provider) {
    case 'anthropic':
      return callAnthropic(cfg.apiKey, cfg.model, testSystem, testUser, 20);
    case 'openai':
      return callOpenAI(cfg.apiKey, cfg.model, testSystem, testUser, 20);
    case 'google':
      return callGoogle(cfg.apiKey, cfg.model, testSystem, testUser, 20);
  }
}
