package tn.damascino.partner.application;

import java.util.UUID;

/** Access given to a beneficiary: login = phone number, temporary password to change at first login. */
public record IssuedCredentials(UUID beneficiaryId, String firstName, String lastName, String phone,
                                String temporaryPassword) {
}
