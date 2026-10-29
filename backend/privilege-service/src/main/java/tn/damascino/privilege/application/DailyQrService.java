package tn.damascino.privilege.application;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.common.security.Secrets;
import tn.damascino.privilege.application.command.GenerateQrHandler;
import tn.damascino.privilege.domain.DailyQr;
import tn.damascino.privilege.domain.DailyQrRepository;
import tn.damascino.privilege.projection.BeneficiaryProjection;
import tn.damascino.privilege.qr.QrPayload;
import tn.damascino.privilege.qr.QrTokenService;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;

@Component
public class DailyQrService {

    private final DailyQrRepository dailyQrRepository;
    private final GenerateQrHandler qrRules;
    private final QuotaService quota;
    private final QrTokenService qrTokens;
    private final Clock clock;

    public DailyQrService(DailyQrRepository dailyQrRepository, GenerateQrHandler qrRules, QuotaService quota,
                          QrTokenService qrTokens, Clock clock) {
        this.dailyQrRepository = dailyQrRepository;
        this.qrRules = qrRules;
        this.quota = quota;
        this.qrTokens = qrTokens;
        this.clock = clock;
    }

    /**
     * The same code all day, valid until midnight. It is replaced when it can no longer be accepted at the till: used
     * (several passages a day), or signed for a previous session (login on another device).
     */
    @Transactional
    public String getOrGenerateDailyQr(AuthenticatedUser user) {
        BeneficiaryProjection beneficiary = qrRules.checkCanShowQr(user);
        LocalDate today = LocalDate.now(clock);
        Instant now = clock.instant();
        DailyQr existing = dailyQrRepository.findByBeneficiaryIdAndQrDate(beneficiary.getId(), today).orElse(null);
        if (existing != null && !existing.isUsed() && stillAccepted(existing.getQrCode(), user, now)) {
            return existing.getQrCode();
        }

        Instant midnight = today.plusDays(1).atStartOfDay(clock.getZone()).toInstant();
        String qrCode = qrTokens.sign(new QrPayload(beneficiary.getId(), Secrets.randomToken(16),
                user.sessionVersion(), midnight));
        if (existing == null) {
            dailyQrRepository.save(new DailyQr(beneficiary.getId(), qrCode, today, now));
        } else {
            existing.renew(qrCode, now);
            dailyQrRepository.save(existing);
        }
        return qrCode;
    }

    private boolean stillAccepted(String qrCode, AuthenticatedUser user, Instant now) {
        return qrTokens.read(qrCode)
                .filter(p -> p.expiresAt().isAfter(now))
                .filter(p -> p.sessionVersion() >= user.sessionVersion())
                .filter(p -> !quota.isNonceUsed(p.nonce()))
                .isPresent();
    }
}
