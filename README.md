<p align="center">
  <img src="assets/images/icon.png" width="96" alt="Mindful Wallet icon" />
</p>

<h1 align="center">Mindful Wallet</h1>

<p align="center">An AI spending-awareness coach for iOS, built with Expo.</p>

## What it does

Mindful Wallet helps you notice spending patterns before they become a problem — track expenses, set weekly budgets and savings goals, and get nudged by a coach when a purchase is about to blow past your limits.

- **Spending tracking** — quick-add expenses, custom categories, edit/delete, full history & calendar view
- **Budgets & goals** — weekly category limits, smart budget suggestions based on your own history, multiple savings goals
- **Charts** — spend heat map, category breakdown, and an interactive spending trend chart (7 days / month / 6 months / year)
- **AI coach** — ask "should I buy this?" and get an answer weighed against your budget. Choose your own provider (Anthropic, OpenAI, or Google — bring your own API key) or use the built-in **free local coach**, a rule-based assistant that runs entirely on-device with no key and no server
- **Proactive nudges** — local notifications for over-budget spending, a weekly recap, and recurring-expense/subscription detection
- **Privacy-first** — Face ID / biometric app lock, on-device data by default, encrypted storage for any API keys you add, and a full data export/import backup
- **Multilingual** — Russian, English, and Ukrainian
- **Premium tier** — optional subscription (via RevenueCat) for real AI providers and unlimited custom categories; the local coach stays free and unlimited for everyone

## Tech stack

- [Expo](https://expo.dev) SDK 54 · React Native 0.81 · React 19 · TypeScript
- Expo Router (file-based navigation)
- `react-native-svg` for charts, `react-native-reanimated` for motion
- `AsyncStorage` + `expo-secure-store` for local data and encrypted keys
- `expo-notifications`, `expo-local-authentication`, `expo-location`
- `react-native-purchases` (RevenueCat) for subscriptions
- Jest (`jest-expo` preset) for unit tests

## Getting started

```bash
npm install
npm run start   # opens the Expo dev tools — press i/w for iOS/web
```

Other scripts:

```bash
npm run ios       # start and open in the iOS simulator
npm run web       # run in a browser
npm test          # run the Jest test suite
```

Requires the [Expo Go](https://expo.dev/go) app (SDK 54 build) for quick testing on a physical device, or an EAS build for a standalone install.

## Privacy

See [PRIVACY.md](PRIVACY.md) — also published at **https://awzi7.github.io/mindful-wallet/**.

## License

[MIT](LICENSE)
