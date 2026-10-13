package tn.damascino.privilege.application;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.security.Secrets;
import tn.damascino.common.web.ApiException;
import tn.damascino.privilege.domain.DailyQr;
import tn.damascino.privilege.domain.DailyQrRepository;
import tn.damascino.privilege.projection.BeneficiaryProjection;
import tn.damascino.privilege.projection.BeneficiaryProjectionRepository;
import tn.damascino.privilege.qr.QrPayload;
import tn.damascino.privilege.qr.QrTokenService;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Component
public class DailyQrService {

    private final DailyQrRepository dailyQrRepository;
    private final BeneficiaryProjectionRepository beneficiaries;
    private final QrTokenService qrTokens;
    private final Clock clock;
    private final Duration qrTtl;

    public DailyQrService(DailyQrRepository dailyQrRepository, BeneficiaryProjectionRepository beneficiaries,
                          QrTokenService qrTokens, Clock clock,
                          @Value("${damascino.qr.ttl}") Duration qrTtl) {
        this.dailyQrRepository = dailyQrRepository;
        this.beneficiaries = beneficiaries;
        this.qrTokens = qrTokens;
        this.clock = clock;
        this.qrTtl = qrTtl;
    }

    @Transactional
    public String getOrGenerateDailyQr(UUID beneficiaryId) {
        LocalDate today = LocalDate.now(clock);
        DailyQr existing = dailyQrRepository.findByBeneficiaryIdAndQrDate(beneficiaryId, today).orElse(null);

        if (existing != null) {
            return existing.getQrCode();
        }

        BeneficiaryProjection beneficiary = beneficiaries.findById(beneficiaryId).orElse(null);
        if (beneficiary == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "BENEFICIARY_NOT_FOUND", "Bénéficiaire non trouvé");
        }

        Instant now = clock.instant();
        Instant expiresAt = now.plus(qrTtl);
        String nonce = Secrets.randomToken(16);
        String qrCode = qrTokens.sign(new QrPayload(beneficiaryId, nonce, 0, expiresAt));

        DailyQr dailyQr = new DailyQr(beneficiaryId, qrCode, today, now);
        dailyQrRepository.save(dailyQr);

        return qrCode;
    }

    @Transactional
    public void markAsUsed(UUID beneficiaryId, String qrCode) {
        LocalDate today = LocalDate.now(clock);
        DailyQr dailyQr = dailyQrRepository.findByBeneficiaryIdAndQrDate(beneficiaryId, today)
                .orElse(null);

        if (dailyQr == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "QR_NOT_FOUND", "Code QR non trouvé pour aujourd'hui");
        }

        if (!dailyQr.getQrCode().equals(qrCode)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_QR_CODE", "Code QR invalide");
        }

        if (dailyQr.isUsed()) {
            throw new ApiException(HttpStatus.CONFLICT, "QR_ALREADY_USED", "Ce code QR a déjà été utilisé aujourd'hui");
        }

        dailyQr.markAsUsed(clock.instant());
        dailyQrRepository.save(dailyQr);
    }

    @Transactional
    public void validateAndMarkAsUsed(UUID beneficiaryId, String qrCode) {
        LocalDate today = LocalDate.now(clock);
        DailyQr dailyQr = dailyQrRepository.findByBeneficiaryIdAndQrDate(beneficiaryId, today)
                .orElse(null);

        if (dailyQr == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "QR_NOT_FOUND", "Code QR non trouvé pour aujourd'hui");
        }

        if (!dailyQr.getQrCode().equals(qrCode)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_QR_CODE", "Code QR invalide");
        }

        if (dailyQr.isUsed()) {
            throw new ApiException(HttpStatus.CONFLICT, "QR_ALREADY_USED", "Ce code QR a déjà été utilisé aujourd'hui");
        }

        dailyQr.markAsUsed(clock.instant());
        dailyQrRepository.save(dailyQr);
    }
}
