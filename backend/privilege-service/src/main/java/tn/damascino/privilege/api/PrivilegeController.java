package tn.damascino.privilege.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tn.damascino.common.cqrs.CommandBus;
import tn.damascino.common.cqrs.QueryBus;
import tn.damascino.common.security.SecuritySupport;
import tn.damascino.privilege.application.DailyQrService;
import tn.damascino.privilege.application.ScanResult;
import tn.damascino.privilege.application.command.ConfirmRedemptionCommand;
import tn.damascino.privilege.application.command.GenerateQrCommand;
import tn.damascino.privilege.application.command.VerifyScanCommand;
import tn.damascino.privilege.application.query.MyPrivilegeQuery;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/privileges")
public class PrivilegeController {

    private final CommandBus commands;
    private final QueryBus queries;
    private final DailyQrService dailyQrService;

    public PrivilegeController(CommandBus commands, QueryBus queries, DailyQrService dailyQrService) {
        this.commands = commands;
        this.queries = queries;
        this.dailyQrService = dailyQrService;
    }

    public record ScanRequest(@NotBlank String token) {
    }

    public record ConfirmRequest(@NotBlank String token, BigDecimal dishPrice) {
    }

    /** Espace bénéficiaire. */
    @GetMapping("/me")
    public MyPrivilegeQuery.Dashboard me() {
        return queries.ask(new MyPrivilegeQuery(SecuritySupport.currentUser()));
    }

    /** Bouton « Utiliser mon avantage » (called again every 30 s while the QR screen is open). */
    @PostMapping("/qr")
    public GenerateQrCommand.QrCode qr() {
        return commands.dispatch(new GenerateQrCommand(SecuritySupport.currentUser()));
    }

    /** Espace personnel : contrôle du QR scanné. */
    @PostMapping("/scan/verify")
    public ScanResult verify(@Valid @RequestBody ScanRequest request) {
        return commands.dispatch(new VerifyScanCommand(SecuritySupport.currentUser(), request.token()));
    }

    /** Espace personnel : confirmation du passage (le QR devient invalide). */
    @PostMapping("/scan/confirm")
    public ScanResult confirm(@Valid @RequestBody ConfirmRequest request) {
        return commands.dispatch(new ConfirmRedemptionCommand(SecuritySupport.currentUser(), request.token(),
                request.dishPrice()));
    }

    public record DailyQrResponse(String qrCode) {
    }

    /** QR code of the day, renewed at midnight. */
    @GetMapping("/qr/daily")
    public DailyQrResponse dailyQr() {
        var user = SecuritySupport.currentUser();
        String qrCode = dailyQrService.getOrGenerateDailyQr(user.beneficiaryId());
        return new DailyQrResponse(qrCode);
    }
}
