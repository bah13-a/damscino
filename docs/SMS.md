# Activation par SMS

Les bénéficiaires activent leur compte et se connectent avec un **code reçu par SMS** :

1. Le collaborateur ouvre l'application (ou le **lien d'activation** de son entreprise) et saisit son **numéro**.
2. Le numéro doit figurer sur la **liste importée** du partenaire (et sur la liste *de ce partenaire* quand l'application
   a été ouverte depuis son lien : posséder le lien ne donne aucun accès). Sinon l'inscription est refusée.
3. Un **code à 6 chiffres** est envoyé par SMS. Il est valable **5 minutes**, avec **3 essais** au maximum.
4. Le code juste **active le compte** (il est compté dans « comptes activés ») et ouvre une session longue sur ce
   téléphone. Un nouveau code n'est demandé qu'en cas de **changement de téléphone** : l'ancien est alors déconnecté.

Protections contre les abus et les frais : 60 secondes entre deux envois, **3 codes par numéro et par heure**,
30 demandes par heure et par adresse réseau (numéros refusés compris), code stocké haché, jamais renvoyé par l'API en
production.

Le **mot de passe temporaire** reste une solution de secours (lien *J'ai un mot de passe* dans l'application). Il est
désactivé dès que le bénéficiaire s'active par SMS. Le **personnel de caisse** garde identifiant + code PIN, et
l'**administration** son identifiant + mot de passe sur le site.

## Outil d'envoi gratuit : SMS Gateway for Android

Aucun opérateur ni agrégateur n'envoie de SMS gratuitement. La solution gratuite retenue est
**[SMS Gateway for Android](https://sms-gate.app)** (open source, licence Apache 2.0) : un téléphone Android muni d'une
**puce tunisienne** envoie les SMS avec son propre forfait. Le logiciel et le relais cloud sont gratuits ; le seul coût
est celui des SMS du forfait de la puce, et une option « SMS illimités » d'Ooredoo, Orange ou Tunisie Telecom le
réduit à presque rien.

| | |
|---|---|
| Coût du logiciel | 0 DT (open source) |
| Coût des SMS | Celui du forfait de la puce (option SMS illimités recommandée) |
| Matériel | Un téléphone Android 5.0 ou plus récent, même d'entrée de gamme, dédié à cet usage |
| Volume | Environ 1 SMS par bénéficiaire à l'activation, puis seulement en cas de changement de téléphone |

### Mise en place (15 minutes)

1. **Téléphone dédié** : insérer une puce avec une option SMS, le brancher sur secteur et le connecter au Wi-Fi.
2. **Installer l'application** *SMS Gateway for Android* depuis [sms-gate.app](https://sms-gate.app) (fichier APK de
   la dernière version, publié aussi sur GitHub : `capcom6/android-sms-gateway`), puis lui accorder l'autorisation **SMS**.
3. Dans l'application, activer **Cloud server**, puis toucher **Online**. La rubrique *Cloud Server* affiche un
   **nom d'utilisateur** et un **mot de passe**.
4. Dans les réglages Android : **désactiver l'optimisation de batterie** pour l'application (sinon Android peut la
   mettre en veille) et la laisser tourner en permanence.
5. Sur le serveur, compléter le fichier `.env` :

   ```bash
   SMS_GATEWAY_USER=<nom d'utilisateur affiché par l'application>
   SMS_GATEWAY_PASSWORD=<mot de passe affiché par l'application>
   ```

6. Redémarrer : `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d identity-service`.
7. **Tester** : dans l'application Damascino Privilèges, saisir le numéro d'un bénéficiaire de test. Le SMS doit
   arriver en quelques secondes ; en cas d'échec, l'application affiche « L'envoi du SMS a échoué » et le journal
   `docker compose logs identity-service` indique la cause.

> Conseil : dans *SMS Gateway for Android*, régler une **limite d'envoi** (par exemple 30 SMS / 30 min) pour ne jamais
> déclencher les protections anti-spam de l'opérateur.

### Variantes

- **Serveur local** (le téléphone et le serveur sur le même réseau) : activer *Local server* dans l'application et
  indiquer `SMS_GATEWAY_URL=http://<adresse-du-téléphone>:8080`.
- **Relais privé** : le relais cloud d'sms-gate.app peut être auto-hébergé ; indiquer alors son adresse dans
  `SMS_GATEWAY_URL`.
- **Fournisseur professionnel** plus tard (volume important, nom d'expéditeur « DAMASCINO ») : l'envoi est isolé
  dans l'interface `SmsSender` du service `identity-service` ; un nouveau fournisseur s'ajoute sans toucher au reste.

## Environnements

| Variable | Test (`docker-compose.yml`) | Production (`docker-compose.prod.yml`) |
|---|---|---|
| `SMS_PROVIDER` | `log` : aucun SMS, le code est écrit dans le journal | `android-gateway` |
| `SMS_EXPOSE_CODES` | `true` : l'application de test affiche le code (« Environnement de test : … ») | `false` (forcé) |
| `SMS_GATEWAY_URL` | — | `https://api.sms-gate.app/3rdparty/v1` (défaut) |
| `SMS_GATEWAY_USER`, `SMS_GATEWAY_PASSWORD` | — | identifiants affichés par l'application Android |
| `SMS_CODE_TTL` | `5m` | `5m` |
| `SMS_RESEND_DELAY` | `60s` | `60s` |
| `SMS_MAX_PER_PHONE_HOUR` | `3` | `3` |
| `SMS_MAX_PER_IP_HOUR` | `1000` (tests automatisés) | `30` |

En test, on peut aussi brancher le vrai téléphone passerelle : `SMS_PROVIDER=android-gateway` et les deux
identifiants dans `.env`. Le code n'est alors **jamais** affiché dans l'application, même si `SMS_EXPOSE_CODES=true`.

## API

| Appel | Corps | Réponses |
|---|---|---|
| `POST /api/auth/sms/request` | `{ "phone": "98123456", "partnerId": "<optionnel>" }` | `200 { maskedPhone, expiresIn, resendIn, devCode }` · `400 INVALID_PHONE` · `403 NUMBER_NOT_AUTHORIZED` / `ACCOUNT_DISABLED` / `MOBILE_APP_REQUIRED` · `429 SMS_RESEND_TOO_SOON` / `SMS_LIMIT_REACHED` / `SMS_RATE_LIMITED` · `503 SMS_UNAVAILABLE` |
| `POST /api/auth/sms/verify` | `{ "phone": "98123456", "code": "123456" }` | `200` session (comme `/api/auth/login`) · `401 INVALID_SMS_CODE` · `429 SMS_CODE_BLOCKED` · `400 SMS_CODE_EXPIRED` |

Les deux appels exigent l'en-tête `X-Client-App` de l'application mobile.
