# PlayMap iOS Release Commands

Do not run these until the owner has completed Apple Developer, App Store Connect, bundle identifier, privacy URL, and support URL decisions.

Use `npx eas-cli` because a global EAS install is not required.

```bash
npx eas-cli login
npx eas-cli whoami
npx eas-cli build:configure
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

For local validation before an external build:

```bash
npx tsc --noEmit
npm run lint
npm test -- --watch=false
npx expo-doctor
npx expo export --platform web
```
