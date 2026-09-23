package tn.damascino.partner.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.partner.application.importing.ImportReport;

import java.util.UUID;

public record ImportBeneficiariesCommand(AuthenticatedUser actor, UUID partnerId, String filename, byte[] content)
        implements Command<ImportReport> {
}
