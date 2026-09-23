package tn.damascino.partner.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;

/** Re-emits the snapshot of every partner and beneficiary so that read models can be rebuilt from scratch. */
public record RepublishSnapshotsCommand(AuthenticatedUser actor) implements Command<Integer> {
}
