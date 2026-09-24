package tn.damascino.privilege.application.command;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.common.security.Role;
import tn.damascino.common.security.Secrets;
import tn.damascino.common.web.ApiException;
import tn.damascino.privilege.domain.EligibilityPolicy;
import tn.damascino.privilege.application.QuotaService;
import tn.damascino.privilege.domain.RefusalReason;
import tn.damascino.privilege.projection.BeneficiaryProjection;
import tn.damascino.privilege.projection.BeneficiaryProjectionRepository;
import tn.damascino.privilege.projection.PartnerProjection;
import tn.damascino.privilege.projection.PartnerProjectionRepository;
import tn.damascino.privilege.qr.QrPayload;
import tn.damascino.privilege.qr.QrTokenService;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;

@Component
public class GenerateQrHandler implements CommandHandler<GenerateQrCommand, GenerateQrCommand.QrCode> {

    private final BeneficiaryProjectionRepository beneficiaries;
    private final PartnerProjectionRepository partners;
    private final QuotaService quota;
    private final QrTokenService qrTokens;
    private final Clock clock;
    private final Duration ttl;
    private final Duration refreshInterval;

    public GenerateQrHandler(BeneficiaryProjectionRepository beneficiaries, PartnerProjectionRepository partners,
                             QuotaService quota, QrTokenService qrTokens, Clock clock,
                             @Value("${damascino.qr.ttl}") Duration ttl,
                             @Value("${damascino.qr.refresh-interval}") Duration refreshInterval) {
        this.beneficiaries = beneficiaries;
        this.partners = partners;
        this.quota = quota;
        this.qrTokens = qrTokens;
        this.clock = clock;
        this.ttl = ttl;
        this.refreshInterval = refreshInterval;
    }

    @Override
    @Transactional(readOnly = true)
    public GenerateQrCommand.QrCode handle(GenerateQrCommand command) {
        AuthenticatedUser user = command.user();
        if (user.role() != Role.BENEFICIARY || user.beneficiaryId() == null) {
            throw ApiException.forbidden("FORBIDDEN", "Réservé aux bénéficiaires");
        }
        if (user.passwordChangeRequired()) {
            throw ApiException.forbidden("PASSWORD_CHANGE_REQUIRED", "Veuillez d'abord changer votre mot de passe");
        }
        BeneficiaryProjection beneficiary = beneficiaries.findById(user.beneficiaryId()).orElse(null);
        if (beneficiary != null && user.sessionVersion() < beneficiary.getSessionVersion()) {
            throw ApiException.unauthorized("SESSION_REPLACED",
                    "Votre compte est connecté sur un autre appareil. Reconnectez-vous pour utiliser votre avantage.");
        }
        PartnerProjection partner = beneficiary == null || beneficiary.getPartnerId() == null
                ? null : partners.findById(beneficiary.getPartnerId()).orElse(null);
        LocalDate today = LocalDate.now(clock);
        long used = partner == null ? 0
                : quota.used(beneficiary.getId(), partner.getUsagePeriod().keyOf(today));
        RefusalReason refusal = EligibilityPolicy.evaluate(beneficiary, partner, today, used).orElse(null);
        if (refusal != null) {
            throw new ApiException(HttpStatus.CONFLICT, refusal.name(), refusal.message());
        }

        Instant now = clock.instant();
        Instant expiresAt = now.plus(ttl);
        String token = qrTokens.sign(new QrPayload(beneficiary.getId(), Secrets.randomToken(16),
                user.sessionVersion(), expiresAt));
        return new GenerateQrCommand.QrCode(token, expiresAt, refreshInterval.toSeconds(), now);
    }
}
