package tn.damascino.privilege.pos;

import tn.damascino.common.cqrs.Command;

/** The ticket was paid: the reserved advantage becomes a passage. Idempotent for the same ticket. */
public record PosConfirmCommand(PosPrincipal terminal, PosDtos.ConfirmRequest request)
        implements Command<PosDtos.ConfirmResponse> {
}
