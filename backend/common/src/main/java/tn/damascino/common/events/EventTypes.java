package tn.damascino.common.events;

public final class EventTypes {

    public static final String PARTNER_CHANGED = "partner.changed";
    public static final String BENEFICIARY_CHANGED = "beneficiary.changed";
    public static final String BENEFICIARY_CREDENTIALS_ISSUED = "beneficiary.credentials-issued";
    public static final String ACCOUNT_ACTIVATED = "identity.account-activated";
    public static final String BENEFICIARY_SESSION_CHANGED = "identity.beneficiary-session-changed";
    public static final String REDEMPTION_CONFIRMED = "privilege.redemption-confirmed";
    public static final String REDEMPTION_REJECTED = "privilege.redemption-rejected";
    public static final String AUDIT_RECORDED = "audit.recorded";

    private EventTypes() {
    }
}
