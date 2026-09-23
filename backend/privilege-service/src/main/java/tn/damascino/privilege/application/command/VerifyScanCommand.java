package tn.damascino.privilege.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.privilege.application.ScanResult;

/** First step at the till: checks the scanned code and shows the green or red screen (nothing is consumed). */
public record VerifyScanCommand(AuthenticatedUser staff, String token) implements Command<ScanResult> {
}
