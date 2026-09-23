package tn.damascino.privilege.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.privilege.application.ScanResult;

import java.math.BigDecimal;

/**
 * Second step at the till: consumes the code and records the passage.
 *
 * @param dishPrice price of the discounted dish in DT (optional, used to compute the discounts granted)
 */
public record ConfirmRedemptionCommand(AuthenticatedUser staff, String token, BigDecimal dishPrice)
        implements Command<ScanResult> {
}
