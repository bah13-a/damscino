package tn.damascino.privilege.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tn.damascino.common.web.ApiException;
import tn.damascino.privilege.application.DailyQrService;
import tn.damascino.privilege.projection.BeneficiaryProjection;
import tn.damascino.privilege.projection.BeneficiaryProjectionRepository;
import tn.damascino.privilege.projection.PartnerProjection;
import tn.damascino.privilege.projection.PartnerProjectionRepository;
import tn.damascino.privilege.qr.QrTokenService;

import java.math.BigDecimal;
import java.time.Clock;

@RestController
@RequestMapping("/api/pos/v1")
public class TillQrController {

    private final DailyQrService dailyQrService;
    private final BeneficiaryProjectionRepository beneficiaries;
    private final PartnerProjectionRepository partners;
    private final QrTokenService qrTokens;
    private final Clock clock;

    public TillQrController(DailyQrService dailyQrService, BeneficiaryProjectionRepository beneficiaries,
                            PartnerProjectionRepository partners, QrTokenService qrTokens, Clock clock) {
        this.dailyQrService = dailyQrService;
        this.beneficiaries = beneficiaries;
        this.partners = partners;
        this.qrTokens = qrTokens;
        this.clock = clock;
    }

    public record ValidateQrRequest(@NotBlank String qrCode) {
    }

    public record ValidateQrResponse(
            boolean valid,
            String discountName,
            BigDecimal discountPercent,
            String clientName
    ) {
    }

    /** Validate QR code for till integration. Called by the till after scanning. */
    @PostMapping("/validate-qr")
    public ValidateQrResponse validateQr(@Valid @RequestBody ValidateQrRequest request) {
        var payload = qrTokens.read(request.qrCode)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_QR", "Code QR invalide"));

        if (payload.expiresAt().isBefore(clock.instant())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "QR_EXPIRED", "Le code QR a expiré");
        }

        BeneficiaryProjection beneficiary = beneficiaries.findById(payload.beneficiaryId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "BENEFICIARY_NOT_FOUND", "Bénéficiaire non trouvé"));

        PartnerProjection partner = beneficiary.getPartnerId() == null ? null
                : partners.findById(beneficiary.getPartnerId()).orElse(null);

        if (partner == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NO_PARTNER", "Bénéficiaire n'a pas de partenaire");
        }

        dailyQrService.validateAndMarkAsUsed(beneficiary.getId(), request.qrCode);

        String clientName = (beneficiary.getFirstName() != null ? beneficiary.getFirstName() + " " : "")
                + (beneficiary.getLastName() != null ? beneficiary.getLastName() : "");

        return new ValidateQrResponse(
                true,
                "Damascino Privilèges",
                partner.getDiscountPercent(),
                clientName.trim()
        );
    }
}
