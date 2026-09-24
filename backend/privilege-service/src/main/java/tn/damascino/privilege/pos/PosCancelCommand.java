package tn.damascino.privilege.pos;

import tn.damascino.common.cqrs.Command;

/** Ticket cancelled or refunded: releases the reservation or cancels the passage. Idempotent. */
public record PosCancelCommand(PosPrincipal terminal, PosDtos.CancelRequest request)
        implements Command<PosDtos.CancelResponse> {
}
