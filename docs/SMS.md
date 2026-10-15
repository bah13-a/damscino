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

## Fournisseur professionnel : Twilio

[Twilio](https://www.twilio.com) envoie les SMS sans téléphone à entretenir, avec le nom d'expéditeur
**DAMASCINO**. Payant : environ 0,25 $ par SMS vers la Tunisie (tarif à vérifier sur twilio.com/sms/pricing/tn).

### Mise en place (10 minutes)

1. **Créer un compte** sur [twilio.com](https://www.twilio.com/try-twilio) et l'**approvisionner** (*Billing*) : un
   compte d'essai n'envoie qu'aux numéros vérifiés.
2. **Autoriser la Tunisie** : Console → *Messaging* → *Settings* → **Geo permissions** → cocher **Tunisia**.
3. **Expéditeur** : le nom `DAMASCINO` (11 caractères maximum) convient pour la Tunisie. Si Twilio le refuse,
   acheter un numéro Twilio (*Phone Numbers* → *Buy a number*) et l'utiliser comme expéditeur.
4. Relever l'**Account SID** (`AC…`) et l'**Auth Token** : Console → *Account Info*.
5. Sur le serveur :

   ```bash
   sudo bash /opt/damascino/infra/configure-sms.sh twilio
   ```

   Le script demande l'Account SID, l'Auth Token (non affiché), l'expéditeur, **vérifie les identifiants auprès de
   Twilio**, propose un **SMS de test**, enregistre la configuration dans `.env` puis redémarre le service. En cas
   de refus, il affiche la raison (pays non autorisé, expéditeur refusé…) et ne modifie rien.

Les identifiants restent dans `/opt/damascino/.env` (lisible par root uniquement) et sont conservés par les mises à
jour automatiques. Pour revenir au téléphone Android : `sudo bash /opt/damascino/infra/configure-sms.sh android-gateway`.

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
5. Sur le serveur : `sudo bash /opt/damascino/infra/configure-sms.sh android-gateway`, puis saisir le nom
   d'utilisateur et le mot de passe affichés par l'application (le service redémarre tout seul).
6. **Tester** : dans l'application Damascino Privilèges, saisir le numéro d'un bénéficiaire de test. Le SMS doit
   arriver en quelques secondes ; en cas d'échec, l'application affiche « L'envoi du SMS a échoué » et le journal
   `docker compose logs identity-service` indique la cause.

> Conseil : dans *SMS Gateway for Android*, régler une **limite d'envoi** (par exemple 30 SMS / 30 min) pour ne jamais
> déclencher les protections anti-spam de l'opérateur.

### Variantes

- **Serveur local** (le téléphone et le serveur sur le même réseau) : activer *Local server* dans l'application et
  indiquer `SMS_GATEWAY_URL=http://<adresse-du-téléphone>:8080`.
- **Relais privé** : le relais cloud d'sms-gate.app peut être auto-hébergé ; indiquer alors son adresse dans
  `SMS_GATEWAY_URL`.
- **Autre fournisseur** : l'envoi est isolé dans l'interface `SmsSender` du service `identity-service`
  (`LogSmsSender`, `AndroidGatewaySmsSender`, `TwilioSmsSender`) ; un nouveau fournisseur s'ajoute sans toucher au reste.

## Environnements

| Variable | Test (`docker-compose.yml`) | Production (`docker-compose.prod.yml`) |
|---|---|---|
| `SMS_PROVIDER` | `log` : aucun SMS, le code est écrit dans le journal | `android-gateway` (défaut) ou `twilio` |
| `SMS_EXPOSE_CODES` | `true` : l'application de test affiche le code (« Environnement de test : … ») | `false` (forcé) |
| `SMS_GATEWAY_URL` | — | `https://api.sms-gate.app/3rdparty/v1` (défaut) |
| `SMS_GATEWAY_USER`, `SMS_GATEWAY_PASSWORD` | — | identifiants affichés par l'application Android |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | — | identifiants Twilio (`twilio`) |
| `TWILIO_FROM` | — | `DAMASCINO` ou un numéro Twilio |
| `TWILIO_MESSAGING_SERVICE_SID` | — | facultatif (`MG…`), remplace `TWILIO_FROM` |
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
