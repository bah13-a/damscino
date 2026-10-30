# Application mobile Damascino Privilèges

Les **bénéficiaires** et le **personnel de caisse** utilisent l'application mobile (Android et iPhone). Le site web
ne sert plus qu'à l'**administration** ; pour les autres, il affiche la page de téléchargement de l'application.

| | Application mobile (`mobile/`) | Site web (`frontend/`) |
|---|---|---|
| Bénéficiaire | Activation par code SMS (mot de passe en secours), avantage du jour, QR code, historique | Page de téléchargement (`/`, lien d'activation `/connexion?p=…`) |
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
- **Résultat du scan en direct chez le client** : dès que le code est scanné (téléphone du caissier, ou douchette
  branchée sur la caisse, voir `INTEGRATION_CAISSE.md`), le téléphone du client affiche
  « Code scanné en caisse », puis « Remise appliquée » (pourcentage, montant, caissier, heure) ou le motif du refus.
  Le dernier scan du jour reste visible dans « Mon espace ».
- Icône et écran de démarrage aux couleurs de Damascino.

## Technique

- [Expo](https://expo.dev) (React Native, TypeScript), navigation *Expo Router* (`mobile/src/app/`).
- Modules : `expo-camera` (lecture des QR), `expo-secure-store`, `expo-screen-capture`, `expo-brightness`,
  `expo-keep-awake`, `react-native-qrcode-svg`.
- Même API que le site : l'application appelle `https://<adresse du site>/api/...`.
- L'adresse du serveur est fixée à la compilation (`EXPO_PUBLIC_API_URL`), l'environnement par `APP_ENV`
  (`test` / `prod`). En option (`APP_ALLOW_SERVER_CHANGE=1`, jamais en production), l'adresse peut aussi être changée
  dans l'application (lien *Serveur : … · Modifier*).
- `EXPO_PUBLIC_STAFF_IDLE_MINUTES` : déconnexion automatique du scanner (défaut 5 min).

## Environnements test et production

Deux applications distinctes, installables côte à côte sur le même téléphone, chacune reliée à **son** serveur
(l'adresse est intégrée dans l'application : rien à saisir sur le téléphone) :

| | Test | Production |
|---|---|---|
| Nom sur le téléphone | **Privilèges TEST** (bandeau orange « Environnement de test ») | **Damascino Privilèges** |
| Identifiant Android | `tn.damascino.privileges.test` | `tn.damascino.privileges` |
| Serveur | Codespace (ou serveur de recette) | Serveur de production (ex. `https://privileges.damascino.tn`) |
| Compilation | automatique à chaque modification de `mobile/` | à la demande (bouton *Run workflow*) |
| Téléchargement | `…/releases/download/android-test/damascino-privileges-test.apk` | `…/releases/download/android-prod/damascino-privileges.apk` |
| Lien du site | `docker-compose.yml` (Codespace) | `docker-compose.prod.yml` (serveur de production) |

## Obtenir l'APK Android (gratuit, GitHub Actions)

Le workflow **Application mobile (APK Android)** (`.github/workflows/mobile-apk.yml`) compile l'application et la
publie comme **release GitHub** de son environnement (`android-test` ou `android-prod`, remplacée à chaque
compilation : le lien de téléchargement ne change jamais). Compter 25 à 30 minutes.

**Réglages** : GitHub → **Settings → Environments** → `test` et `prod` (créés automatiquement au premier lancement) :
- variable `APP_API_URL` = adresse du site de l'environnement, en `https://` ;
  - *test* : facultative (par défaut, l'adresse du Codespace actuel, inscrite dans le workflow) — à renseigner si
    vous changez de Codespace ;
  - *prod* : **obligatoire** (ex. `https://privileges.damascino.tn`) ;
- secrets de signature (voir plus bas), indispensables pour la production.

**Version test** : se recompile seule à chaque modification de l'application ; ou **Actions → Application mobile
(APK Android) → Run workflow → environnement `test`**.

**Version production** : **Actions → Application mobile (APK Android) → Run workflow → environnement `prod`**.

> **Dépôt privé :** les fichiers des releases d'un dépôt privé ne sont pas téléchargeables sans compte GitHub.
> Hébergez alors l'APK ailleurs (Google Drive, serveur Damascino, Play Store) et indiquez son adresse au site :
> variable `NEXT_PUBLIC_ANDROID_APP_URL` à la construction du frontend (avec Docker Compose :
> `ANDROID_APP_URL=https://… docker compose up -d --build frontend`, idem `IOS_APP_URL`).

**Installation sur un téléphone Android :** ouvrir le lien, télécharger l'APK, l'ouvrir et
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

## Obtenir l'APK sans GitHub Actions (EAS Build, gratuit)

Quand GitHub Actions n'est pas disponible (facturation, quota), le serveur fait compiler l'application par EAS Build
(service d'Expo, plan gratuit) pour **sa propre adresse** et la met à disposition au même endroit
(`/downloads/damascino-privileges.apk`, QR code de la page d'accueil) :

```bash
cd /opt/damascino && sudo bash infra/build-apk.sh
```

- Prérequis : un compte Expo gratuit et un **jeton d'accès** (expo.dev → Account settings → Access tokens), demandé à
  la première exécution puis conservé dans `.env` (`EXPO_TOKEN`).
- Première compilation : répondre « Yes » quand EAS propose de générer la clé de signature Android ; Expo la conserve
  et la réutilise, les APK suivantes s'installent en mise à jour. Les téléphones qui ont une APK signée par une autre
  clé (GitHub Actions) doivent désinstaller l'ancienne application d'abord.
- L'adresse du serveur est intégrée à l'APK : associer une **Elastic IP** avant de compiler, sinon l'application
  cesse de fonctionner au prochain changement d'adresse.
- La compilation se fait chez Expo (de quelques minutes à plus d'une heure selon la file d'attente du plan gratuit).
- Une APK compilée ailleurs s'installe avec les mêmes contrôles : `sudo bash infra/download-apk.sh url <adresse>`.

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
