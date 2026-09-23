package tn.damascino.partner.application.query;

/** Line of the access list handed to a partner: login + temporary password while the account is not activated. */
public record AccessRow(String lastName, String firstName, String login, String temporaryPassword, String status) {
}
