package tn.damascino.identity.application.query;

import tn.damascino.common.cqrs.Query;

import java.util.UUID;

public record MeQuery(UUID accountId) implements Query<AccountView> {
}
