package tn.damascino.privilege.domain;

/** Why a QR code is refused at the till, with the message displayed on the red scanner screen. */
public enum RefusalReason {
    INVALID_QR("QR code invalide"),
    QR_EXPIRED("QR code expiré : demandez au client d'afficher le code actuel"),
    QR_ALREADY_USED("QR code déjà utilisé"),
    SESSION_REPLACED("QR code révoqué : le compte s'est connecté sur un autre appareil"),
    UNKNOWN_ACCOUNT("Compte inconnu"),
    BENEFICIARY_INACTIVE("Bénéficiaire désactivé"),
    PARTNER_INACTIVE("Partenaire inactif"),
    CONVENTION_NOT_STARTED("Convention pas encore commencée"),
    CONVENTION_EXPIRED("Convention expirée"),
    QUOTA_REACHED("Avantage déjà utilisé pour cette période");

    private final String message;

    RefusalReason(String message) {
        this.message = message;
    }

    public String message() {
        return message;
    }
}
