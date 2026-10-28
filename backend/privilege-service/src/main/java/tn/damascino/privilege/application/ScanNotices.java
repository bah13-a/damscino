package tn.damascino.privilege.application;

import org.springframework.stereotype.Component;
import tn.damascino.privilege.domain.RefusalReason;
import tn.damascino.privilege.domain.ScanNoticeRepository;
import tn.damascino.privilege.projection.BeneficiaryProjection;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.UUID;

/** Tells the beneficiary's app what happened to their QR code at the till, whichever way it was scanned. */
@Component
public class ScanNotices {

    private final ScanNoticeRepository notices;
    private final Clock clock;

    public ScanNotices(ScanNoticeRepository notices, Clock clock) {
        this.notices = notices;
        this.clock = clock;
    }

    /** Code read and accepted, the cashier is finishing the passage. */
    public void scanned(UUID beneficiaryId, String staffName, BigDecimal discountPercent) {
        notices.record(beneficiaryId, ScanResult.Status.VALID.name(), null, "QR code scanné en caisse : avantage valide",
                staffName, discountPercent, null, null, clock.instant());
    }

    public void confirmed(UUID beneficiaryId, String staffName, BigDecimal discountPercent, BigDecimal dishPrice,
                          BigDecimal discountAmount) {
        notices.record(beneficiaryId, ScanResult.Status.CONFIRMED.name(), null, "Remise appliquée", staffName,
                discountPercent, dishPrice, discountAmount, clock.instant());
    }

    /** Nothing to tell when the code does not designate a known beneficiary (invalid or forged QR code). */
    public void refused(BeneficiaryProjection beneficiary, String staffName, RefusalReason reason) {
        if (beneficiary == null || beneficiary.getId() == null) {
            return;
        }
        notices.record(beneficiary.getId(), ScanResult.Status.REFUSED.name(), reason.name(), messageFor(reason),
                staffName, null, null, null, clock.instant());
    }

    /** The scanner messages speak to the cashier; these speak to the customer. */
    static String messageFor(RefusalReason reason) {
        return switch (reason) {
            case QR_EXPIRED -> "Code expiré : présentez à nouveau le code affiché";
            case QR_ALREADY_USED -> "Ce code a déjà été utilisé";
            case SESSION_REPLACED -> "Code révoqué : votre compte s'est connecté sur un autre appareil";
            case NO_ELIGIBLE_ITEM -> "Aucun plat éligible sur votre commande";
            case TICKET_ALREADY_DISCOUNTED -> "Une remise Damascino Privilèges est déjà appliquée sur cette commande";
            case RESERVATION_NOT_FOUND, RESERVATION_EXPIRED ->
                    "La caisse n'a pas pu finaliser la remise : le caissier va scanner à nouveau votre code";
            default -> reason.message();
        };
    }
}
