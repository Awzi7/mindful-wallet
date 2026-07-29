import { Linking } from 'react-native';

/**
 * Public URLs for the app's legal documents, served from the repo's `docs/` folder
 * via GitHub Pages. The App Store requires the purchase screen to link to both of
 * these (Guideline 3.1.2), and both must stay reachable for as long as the app ships.
 */
export const PRIVACY_POLICY_URL = 'https://awzi7.github.io/mindful-wallet/';
export const TERMS_OF_USE_URL = 'https://awzi7.github.io/mindful-wallet/terms.html';

/** Opens a legal page in the system browser. Never throws — a failed open is a no-op. */
export async function openLegalUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    // Nothing useful to do if the platform refuses to open the URL.
  }
}
