# Launch checklist

What stands between this repository and real money. None of it is code waiting to be written: it is
credentials, approvals, decisions and checks that need a device or a live account. It replaces
`REAL_LIFE_ANALYSIS.md` and `REAL_LIFE_READINESS.md`, whose code findings were all closed by 2026-09-27;
their history is in git.

## 1. Decisions waiting on the owner

| Decision                                              | State                                                                                                                                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Empty the service test databases before each test run | `scripts/db-test.sh reset` and `scripts/vitest-unit-setup.mjs` are written and have never been run. The databases hold tens of thousands of leftover rows. Nothing resets until the setup file is named in `vitest.config.ts`. |
| PostgreSQL 17 → 18                                    | Not taken. A major version changes the data directory format, so existing volumes do not start under it; it is a dump and restore. Dependabot ignores major bumps of the image.                                                |

## 2. Development adapters to replace

The config loader refuses to start in production with any of these, so none can ship by accident.

| #   | Where                                                    | What it does today                                         | Replace with                                                                               |
| --- | -------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | `apps/services/wallet/src/providers/sandbox.provider.ts` | Deterministic deposits and withdrawals; no money moves     | Paystack, Flutterwave or Bachs with live keys                                              |
| 2   | `identityVerification.provider.ts` `sandbox()`           | Verifies by the digits of the number; never calls out      | An approved BVN/NIN provider                                                               |
| 3   | `identityVerification.provider.ts` `unconfigured()`      | Answers 503 for every verification                         | The same provider                                                                          |
| 4   | Email with `EMAIL_SERVICE_PROVIDER=log`                  | Logs mail to the console                                   | SendByte with a live key and a verified sending domain                                     |
| 5   | SMS with `SMS_PROVIDER=log`                              | Logs SMS to the console                                    | Termii: `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_BASE_URL`                            |
| 6   | Push with `PUSH_PROVIDER=none`                           | Sends nothing                                              | FCM: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, plus VAPID keys for web push |
| 7   | Statement storage unset                                  | Statements end FAILED with no link                         | An S3-compatible bucket: `WALLET_STORAGE_*`                                                |
| 8   | KYC storage unset                                        | Uploads answer 503                                         | A bucket: `KYC_STORAGE_*` with `KYC_STORAGE_SSE`                                           |
| 9   | `simulatedFundsEnabled`                                  | `/wallets/deposit` and `/wallets/withdraw` move play money | Off in production; never on beside a real provider                                         |
| 10  | `identity/src/seeds/demo.seed.ts`                        | Creates demo accounts with published passwords             | Nothing; the seed refuses to run in production                                             |
| 11  | `SIMULATION_SEED_SECRET`                                 | A development HMAC secret                                  | 32 random bytes from the secret store                                                      |
| 12  | `INTERNAL_SERVICE_TOKEN`                                 | A development token                                        | A random token read from `INTERNAL_SERVICE_TOKEN_FILE`                                     |
| 13  | `IDENTITY_DATA_KEY`                                      | A public development key                                   | 32 random bytes, base64                                                                    |
| 14  | `WALLET_ENCRYPTION_KEY`                                  | Unset: bank account numbers unencrypted                    | 32 random bytes, base64                                                                    |
| 15  | `PAYMENTS_CALLBACK_BASE_URL`                             | A loopback address                                         | The web origin customers return to, https only                                             |

The customer apps need no change for payments. When the platform answers `paymentsEnabled` in
`GET /config`, the real deposit and withdrawal flows replace the play-money dialog.

## 3. Legal and operational

1. A gambling licence in every jurisdiction served, with age-gating, geoblocking and a self-exclusion policy.
2. Segregated player funds, held in trust apart from the operator's account.
3. A merchant account for payouts.
4. Independent RNG certification for the simulation (eCOGRA, GLI or the local regulator).
5. An approved KYC identity provider.
6. An independent penetration test against the running platform.
7. 24/7 on-call and an incident runbook.
8. A responsible-gaming officer and a written problem-gambling policy.
9. A data retention and NDPR/GDPR review of the KYC document store.

## 4. Push notifications on phones

The platform sends through FCM HTTP v1 and the app registers a device through `expo-notifications`
(`apps/mobile/src/platform/expoPushNotifications.ts`). No notification has reached a device yet.

| Needed                                                                                                                                    | Why                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| An installed build of the app                                                                                                             | Expo Go is signed by Expo and cannot receive BETNG's push                                                                          |
| A Firebase project                                                                                                                        | `google-services.json` beside `apps/mobile/app.config.js`, and the FCM variables on the platform. Both are git-ignored             |
| For iPhone: an Apple developer account and an APNs key, with Firebase's iOS messaging module in the app or an APNs sender on the platform | An iPhone's native token is an APNs token, which FCM cannot address. The app offers no token on iPhone until one of the two exists |

## 5. Not yet verified

| Check                                                   | Why it is open                                                                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The mobile app in the dark theme on Android and iOS     | Needs devices                                                                                                                                          |
| Container publishing                                    | Skipped until the repository variables `FRONTEND_API_URL` (https) and `FRONTEND_WS_URL` (wss) are set                                                  |
| A bulk import of a payment provider's settlement report | Reconciliation asks the provider about each payment it knows. A charge against a reference the platform never created needs the providers' report APIs |

## 6. Dependencies held below the newest release

Everything else is at the newest published version. Each of these was tried.

| Package                                     | Held at | Why                                                                                                                                                    |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `react-native` in `apps/mobile`             | 0.86.3  | Expo SDK 57 cannot bundle React Native 0.87: its bundler loads `react-native/rn-get-polyfills`, which 0.87 does not ship                               |
| `expo-notifications`                        | 57.0.21 | 58 belongs to the Expo SDK 58 preview and imports `Platform`, `UnavailabilityError`, `CodedError` and `uuid` from `expo`, which SDK 57 does not export |
| `@react-native-async-storage/async-storage` | 2.2.0   | Expo Go 57 does not contain the native half of 3.x; the app stops at launch                                                                            |
| `prisma`                                    | 7.10.0  | The `latest` tag is a release candidate that does not match `@prisma/client`                                                                           |
| `pydantic-core`                             | 2.46.5  | The newest pydantic requires exactly this version                                                                                                      |

`react` 19.3.0, `@types/react` 19.3.0, `react-native-screens` 4.28.0, `react-native-safe-area-context` 5.10.0
and `react-native-svg` 15.15.5 are ahead of what `expo install --check` expects for SDK 57. They typecheck,
lint and bundle; they have not been run on a phone since the change on 2026-09-28.

`mysql2`, `deepmerge-ts` and `uuid` are forced to patched versions by `overrides` in
`pnpm-workspace.yaml`; their parents pin them below a security fix.

## 7. Rotating the wallet encryption key

1. Set the new key as `WALLET_ENCRYPTION_KEY` with a higher `WALLET_ENCRYPTION_KEY_VERSION`.
2. Move the old key into `WALLET_ENCRYPTION_KEYS_RETIRED` as `version:base64key`.
3. Deploy. The wallet job re-encrypts bank accounts, verifications and held webhook bodies in batches,
   and re-hashes bank-account lookups in the same write.
4. Wait for `wallet_rekey_complete` in the logs. A row no configured key opens is logged as
   `wallet_rekey_unreadable` and left untouched.
5. Remove the retired entry.

## 8. Testing the mobile app on a phone

`app.json` points at `localhost`, which on a phone is the phone. From the repository root run
`node scripts/dev.mjs`, then in `apps/mobile`:

```
BETNG_MOBILE_API_URL=http://<laptop-ip>:3100 \
BETNG_MOBILE_REALTIME_URL=ws://<laptop-ip>:3008/live \
REACT_NATIVE_PACKAGER_HOSTNAME=<laptop-ip> \
npx expo start --go --lan
```

After any change to the mobile dependencies run `npx expo install --check`. Typecheck, tests and the
bundle all pass on a native module that Expo Go does not contain.
