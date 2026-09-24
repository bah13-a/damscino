# Application mobile Damascino Privilèges

Les **bénéficiaires** et le **personnel de caisse** utilisent l'application mobile (Android et iPhone). Le site web
ne sert plus qu'à l'**administration** ; pour les autres, il affiche la page de téléchargement de l'application.

| | Application mobile (`mobile/`) | Site web (`frontend/`) |
|---|---|---|
| Bénéficiaire | Connexion, mot de passe, avantage du jour, QR code, historique | Page de téléchargement (`/`, lien d'activation `/connexion?p=…`) |
| Personnel de caisse | Connexion (PIN), scanner caméra, consignes de remise en caisse | Page de téléchargement (`/personnel`) |
| Administration | — | Tout le back-office (`/admin`) |

L'API l'impose : une connexion bénéficiaire ou personnel sans l'en-tête `X-Client-App` de l'application est refusée
(403 `MOBILE_APP_REQUIRED`). Réglage : `SECURITY_MOBILE_ONLY_SPACES=false` sur `identity-service` pour revenir en
arrière.

## Ce que l'application apporte par rapport au site

- **Session dans le coffre-fort du téléphone** (Android Keystore / iOS Keychain) plutôt que dans le navigateur.
- **Captures d'écran bloquées** sur l'écran du QR code (Android ; masquage dans le sélecteur d'applications sur iOS).
- **Luminosité au maximum** et écran maintenu allumé pendant l'affichage du QR code.
- **Scanner natif** de la caméra, plus rapide et plus fiable que dans un navigateur, avec vibration au résultat.
- Icône et écran de démarrage aux couleurs de Damascino.

## Technique

- [Expo](https://expo.dev) (React Native, TypeScript), navigation *Expo Router* (`mobile/src/app/`).
- Modules : `expo-camera` (lecture des QR), `expo-secure-store`, `expo-screen-capture`, `expo-brightness`,
  `expo-keep-awake`, `react-native-qrcode-svg`.
- Même API que le site : l'application appelle `https://<adresse du site>/api/...`.
- L'adresse du serveur est fixée à la compilation (`EXPO_PUBLIC_API_URL`). Une **version de test**
  (`EXPO_PUBLIC_ALLOW_SERVER_CHANGE=1`) permet de la changer dans l'application (lien *Serveur : … · Modifier* sur
  l'écran d'accueil), pratique avec un Codespace dont l'adresse change.
- `EXPO_PUBLIC_STAFF_IDLE_MINUTES` : déconnexion automatique du scanner (défaut 5 min).

## Obtenir l'APK Android (gratuit, GitHub Actions)

Le workflow **Application mobile (APK Android)** (`.github/workflows/mobile-apk.yml`) compile l'application à chaque
modification de `mobile/` et la publie comme **release GitHub** (`damascino-privileges.apk`). Le bouton
*Télécharger pour Android* du site pointe vers
`https://github.com/bah13-a/damscino/releases/latest/download/damascino-privileges.apk`.

1. GitHub → **Settings → Secrets and variables → Actions → Variables** :
   - `APP_API_URL` = adresse publique du site (ex. `https://privileges.damascino.tn` ou l'URL du Codespace) ;
   - `APP_ALLOW_SERVER_CHANGE` = `1` pour une version de test, `0` pour la version finale.
2. **Actions → Application mobile (APK Android) → Run workflow** (ou pousser une modification de `mobile/`).
3. Après ~15 à 25 min, l'APK est dans **Releases** (et dans les *artifacts* du run).

> **Dépôt privé :** les fichiers des releases d'un dépôt privé ne sont pas téléchargeables sans compte GitHub.
> Hébergez alors l'APK ailleurs (Google Drive, serveur Damascino, Play Store) et indiquez son adresse au site :
> variable `NEXT_PUBLIC_ANDROID_APP_URL` à la construction du frontend (avec Docker Compose :
> `ANDROID_APP_URL=https://… docker compose up -d --build frontend`, idem `IOS_APP_URL`).

**Installation sur un téléphone Android :** ouvrir le lien, télécharger `damascino-privileges.apk`, l'ouvrir et
autoriser *« Installer des applications inconnues »* pour le navigateur la première fois.

### Signature

Sans configuration, l'APK est signé avec une clé de test : il s'installe directement mais ne peut pas être publié sur
Google Play. Pour signer avec la clé Damascino :

```bash
keytool -genkeypair -v -keystore damascino.keystore -alias damascino -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 damascino.keystore   # → secret ANDROID_KEYSTORE_BASE64
```

Secrets GitHub : `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
**Conservez la clé précieusement** : toutes les mises à jour doivent être signées avec la même.

## Publier sur Google Play et l'App Store

Le plus simple est **EAS Build** (service d'Expo, offre gratuite limitée) avec les profils de `mobile/eas.json` :

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile production   # .aab pour Google Play
npx eas-cli@latest build -p ios --profile production       # iPhone (compte Apple Developer requis)
npx eas-cli@latest submit -p android                        # envoi sur Google Play
npx eas-cli@latest submit -p ios                            # envoi sur App Store Connect / TestFlight
```

Définir `EXPO_PUBLIC_API_URL` dans les variables d'environnement du projet EAS (ou dans `eas.json`).

| Store | Compte | Coût |
|---|---|---|
| Google Play | Google Play Console | 25 $ une fois |
| App Store / TestFlight | Apple Developer Program | 99 $ par an |

Sur iPhone, il n'existe pas d'installation directe comme l'APK : il faut **TestFlight** (test, jusqu'à 10 000
testeurs) ou l'**App Store**. Une fois l'application publiée, renseigner `NEXT_PUBLIC_IOS_APP_URL` pour afficher le
bouton *Télécharger pour iPhone* sur le site.

## Développement

```bash
cd mobile
npm ci
EXPO_PUBLIC_API_URL=https://<adresse> npx expo start    # QR code à scanner avec Expo Go ou une build de dev
npm run typecheck
```

Les modules natifs (caméra, coffre-fort) demandent une *development build* (`npx expo run:android`) ou une build EAS.

## Tests

Les parcours bénéficiaire et scanner des tests Playwright pilotent l'application via son **export web** (utilisé
uniquement pour les tests, jamais déployé), y compris le scan par la caméra :

```bash
cd e2e
npm run build:app      # construit mobile/dist, servi sur http://localhost:8095 pendant les tests
npx playwright test
```
