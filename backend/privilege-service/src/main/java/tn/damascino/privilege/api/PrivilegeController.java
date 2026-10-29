package tn.damascino.privilege.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tn.damascino.common.cqrs.CommandBus;
import tn.damascino.common.cqrs.QueryBus;
import tn.damascino.common.security.SecuritySupport;
import tn.damascino.common.web.ApiException;
import tn.damascino.privilege.application.DailyQrService;
import tn.damascino.privilege.application.ScanResult;
import tn.damascino.privilege.application.command.ConfirmRedemptionCommand;
import tn.damascino.privilege.application.command.CounterScanCommand;
import tn.damascino.privilege.application.command.GenerateQrCommand;
import tn.damascino.privilege.application.command.VerifyScanCommand;
import tn.damascino.privilege.application.query.MyPrivilegeQuery;
import tn.damascino.privilege.pos.PosTerminal;
import tn.damascino.privilege.pos.PosTerminalRepository;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/privileges")
public class PrivilegeController {

    private final CommandBus commands;
    private final QueryBus queries;
    private final DailyQrService dailyQrService;
    private final PosTerminalRepository terminals;

    public PrivilegeController(CommandBus commands, QueryBus queries, DailyQrService dailyQrService,
                               PosTerminalRepository terminals) {
        this.commands = commands;
        this.queries = queries;
        this.dailyQrService = dailyQrService;
        this.terminals = terminals;
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

    /** QR code of the day, renewed at midnight (screen of the beneficiary app). */
    @GetMapping("/qr/daily")
    public DailyQrResponse dailyQr() {
        return new DailyQrResponse(dailyQrService.getOrGenerateDailyQr(SecuritySupport.currentUser()));
    }

    public record Counter(String tillName) {
    }

    /** Public: name of the till of a counter QR code (page opened by a phone camera, app before validating). */
    @GetMapping("/counter/{code}")
    public Counter counter(@PathVariable String code) {
        return terminals.findByCounterCode(code).filter(PosTerminal::isActive)
                .map(t -> new Counter(t.getName()))
                .orElseThrow(() -> ApiException.notFound("QR code de caisse"));
    }

    /** The beneficiary scanned the counter QR code: validates the passage of the period. */
    @PostMapping("/counter/{code}/use")
    public CounterScanCommand.Result useAtCounter(@PathVariable String code) {
        return commands.dispatch(new CounterScanCommand(SecuritySupport.currentUser(), code));
    }
}
