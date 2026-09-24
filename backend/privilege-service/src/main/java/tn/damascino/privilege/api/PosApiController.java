package tn.damascino.privilege.api;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tn.damascino.common.cqrs.CommandBus;
import tn.damascino.privilege.pos.PosCancelCommand;
import tn.damascino.privilege.pos.PosConfirmCommand;
import tn.damascino.privilege.pos.PosDtos;
import tn.damascino.privilege.pos.PosPreviewCommand;
import tn.damascino.privilege.pos.PosPrincipal;

import java.time.Clock;

/**
 * API called by the till software (header {@code X-Api-Key}). See docs/INTEGRATION_CAISSE.md and
 * docs/api-caisse/openapi.yaml.
 */
@RestController
@RequestMapping("/api/pos/v1")
public class PosApiController {

    private final CommandBus commands;
    private final Clock clock;

    public PosApiController(CommandBus commands, Clock clock) {
        this.commands = commands;
        this.clock = clock;
    }

    /** Connection test for the integrator. */
    @GetMapping("/ping")
    public PosDtos.Ping ping() {
        return new PosDtos.Ping(terminal().name(), clock.instant(), "v1");
    }

    @PostMapping("/preview")
    public PosDtos.PreviewResponse preview(@RequestBody PosDtos.PreviewRequest request) {
        return commands.dispatch(new PosPreviewCommand(terminal(), request));
    }

    @PostMapping("/confirm")
    public PosDtos.ConfirmResponse confirm(@RequestBody PosDtos.ConfirmRequest request) {
        return commands.dispatch(new PosConfirmCommand(terminal(), request));
    }

    @PostMapping("/cancel")
    public PosDtos.CancelResponse cancel(@RequestBody PosDtos.CancelRequest request) {
        return commands.dispatch(new PosCancelCommand(terminal(), request));
    }

    private static PosPrincipal terminal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return (PosPrincipal) authentication.getPrincipal();
    }
}
