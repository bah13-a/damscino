package tn.damascino.privilege.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tn.damascino.common.cqrs.CommandBus;
import tn.damascino.privilege.application.ScanResult;
import tn.damascino.privilege.application.command.VerifyScanCommand;
import tn.damascino.privilege.infrastructure.tms.TmsIntegrationService;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/tms")
public class TmsController {

    private final CommandBus commands;
    private final TmsIntegrationService tmsService;
    private static final BigDecimal DISCOUNT_PERCENTAGE = BigDecimal.valueOf(20);

    public TmsController(CommandBus commands, TmsIntegrationService tmsService) {
        this.commands = commands;
        this.tmsService = tmsService;
    }

    public record ValidatePrivilegeRequest(@NotBlank String qrToken) {
    }

    public record ValidatePrivilegeResponse(
            boolean valid,
            BigDecimal discountPercentage,
            String message
    ) {
    }

    /**
     * Valide un QR privilège et retourne le discount à appliquer.
     * La caisse TMS appelle cet endpoint avec le QR scanné.
     */
    @PostMapping("/validate-privilege")
    public ValidatePrivilegeResponse validatePrivilege(@Valid @RequestBody ValidatePrivilegeRequest request) {
        try {
            // Vérifie si le QR est valide (sans authentification utilisateur - accès public pour TMS)
            var scanResult = commands.dispatch(new VerifyScanCommand(null, request.qrToken()));

            if (scanResult.valid()) {
                // QR valide - envoyer la réduction à la caisse TMS
                tmsService.sendDiscountNotification(request.qrToken(), DISCOUNT_PERCENTAGE);
                return new ValidatePrivilegeResponse(true, DISCOUNT_PERCENTAGE, "Privilege validé");
            } else {
                return new ValidatePrivilegeResponse(false, BigDecimal.ZERO, "QR invalide ou expiré");
            }
        } catch (Exception e) {
            return new ValidatePrivilegeResponse(false, BigDecimal.ZERO, "Erreur validation: " + e.getMessage());
        }
    }
}
