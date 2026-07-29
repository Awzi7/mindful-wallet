import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { addTransaction, exportAllData, getProviderSettings, getTransactions, importAllData, setProviderConfig } from '../storage';

function clearSecureStore() {
  (SecureStore as unknown as { __clear: () => void }).__clear();
}

describe('provider API key secure storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    clearSecureStore();
  });

  it('migrates a legacy plaintext apiKey from AsyncStorage into secure storage', async () => {
    await AsyncStorage.setItem(
      '@mw/providers',
      JSON.stringify({ anthropic: { apiKey: 'sk-legacy-plaintext', model: 'claude-sonnet-5' } })
    );

    const settings = await getProviderSettings();

    expect(settings.anthropic.apiKey).toBe('sk-legacy-plaintext');
    expect(settings.anthropic.model).toBe('claude-sonnet-5');
  });

  it('strips the plaintext apiKey out of AsyncStorage once migrated', async () => {
    await AsyncStorage.setItem(
      '@mw/providers',
      JSON.stringify({ anthropic: { apiKey: 'sk-legacy-plaintext', model: 'claude-sonnet-5' } })
    );

    await getProviderSettings();

    const raw = await AsyncStorage.getItem('@mw/providers');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).anthropic.apiKey).toBeUndefined();
    expect(JSON.parse(raw!).anthropic.model).toBe('claude-sonnet-5');
  });

  it('reads a migrated apiKey back from secure storage on a later call with no AsyncStorage key left', async () => {
    await AsyncStorage.setItem('@mw/providers', JSON.stringify({ anthropic: { apiKey: 'sk-legacy', model: 'm' } }));
    await getProviderSettings(); // triggers migration

    await AsyncStorage.removeItem('@mw/providers'); // as if only the model blob had existed all along
    const settings = await getProviderSettings();

    expect(settings.anthropic.apiKey).toBe('sk-legacy');
  });

  it('setProviderConfig writes new apiKeys to secure storage, never to AsyncStorage', async () => {
    await setProviderConfig('openai', { apiKey: 'sk-new-key' });

    const raw = await AsyncStorage.getItem('@mw/providers');
    if (raw) expect(JSON.parse(raw).openai?.apiKey).toBeUndefined();

    const settings = await getProviderSettings();
    expect(settings.openai.apiKey).toBe('sk-new-key');
  });

  it('clears a secure apiKey when set to an empty string', async () => {
    await setProviderConfig('openai', { apiKey: 'sk-to-remove' });
    await setProviderConfig('openai', { apiKey: '' });

    const settings = await getProviderSettings();
    expect(settings.openai.apiKey).toBe('');
  });
});

describe('backup export / import', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    clearSecureStore();
  });

  it('round-trips transactions and a secure apiKey through export then import', async () => {
    await addTransaction({ amount: 42, category: 'food', note: 'lunch' });
    await setProviderConfig('anthropic', { apiKey: 'sk-round-trip' });

    const json = await exportAllData();

    await AsyncStorage.clear();
    clearSecureStore();
    expect(await getTransactions()).toHaveLength(0);

    await importAllData(json);

    const txs = await getTransactions();
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ amount: 42, category: 'food', note: 'lunch' });

    const settings = await getProviderSettings();
    expect(settings.anthropic.apiKey).toBe('sk-round-trip');
  });

  it('rejects a malformed backup file instead of silently importing nothing', async () => {
    await expect(importAllData('not json at all')).rejects.toThrow();
    await expect(importAllData(JSON.stringify({ notTheRightShape: true }))).rejects.toThrow();
  });

  it('ignores keys outside the @mw/ namespace found in a backup file', async () => {
    const payload = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { '@mw/userName': 'Alex', 'some-other-app-key': 'should-not-be-written' },
      secureKeys: {},
    });

    await importAllData(payload);

    expect(await AsyncStorage.getItem('some-other-app-key')).toBeNull();
    expect(await AsyncStorage.getItem('@mw/userName')).toBe('Alex');
  });
});
