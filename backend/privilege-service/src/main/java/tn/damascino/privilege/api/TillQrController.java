package tn.damascino.privilege.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tn.damascino.common.cqrs.CommandBus;
import tn.damascino.privilege.pos.PosPrincipal;
import tn.damascino.privilege.pos.PosValidateQrCommand;

/** Till with a handheld QR scanner and a standard discount: one call per scan (docs/INTEGRATION_CAISSE.md). */
@RestController
@RequestMapping("/api/pos/v1")
public class TillQrController {

    private final CommandBus commands;

    public TillQrController(CommandBus commands) {
        this.commands = commands;
    }

    public record ValidateQrRequest(@NotBlank String qrCode, String cashier, String ticketId) {
    }

    /** Validates the scanned code and records the passage; the till applies its discount when {@code valid}. */
    @PostMapping("/validate-qr")
    public PosValidateQrCommand.Result validateQr(@Valid @RequestBody ValidateQrRequest request) {
        PosPrincipal terminal = (PosPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return commands.dispatch(new PosValidateQrCommand(terminal, request.qrCode(), request.cashier(),
                request.ticketId()));
    }
}
