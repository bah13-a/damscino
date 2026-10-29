package tn.damascino.privilege.application.command;

import tn.damascino.common.cqrs.Command;
import tn.damascino.common.security.AuthenticatedUser;

import java.math.BigDecimal;
import java.time.Instant;

/** The beneficiary scanned the QR code stuck on the counter of a till with the app. */
public record CounterScanCommand(AuthenticatedUser user, String counterCode) implements Command<CounterScanCommand.Result> {

    public enum Status {
        CONFIRMED,
        REFUSED
    }

    /**
     * Screen displayed by the app, which the customer shows to the cashier.
     *
     * @param validationCode code the cashier may note on the ticket (reconciliation)
     */
    public record Result(Status status, String reason, String message, String tillName, String beneficiaryName,
                         String partnerName, String discountName, BigDecimal discountPercent, Instant validatedAt,
                         String validationCode) {
    }
}
