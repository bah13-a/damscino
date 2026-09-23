package tn.damascino.identity.application.query;

import tn.damascino.common.cqrs.Query;
import tn.damascino.common.security.Role;

import java.util.List;

/** Administrators and scanner staff; {@code role} null returns both. */
public record ListStaffAccountsQuery(Role role) implements Query<List<AccountView>> {
}
