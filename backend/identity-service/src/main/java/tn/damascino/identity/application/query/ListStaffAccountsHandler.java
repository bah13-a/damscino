package tn.damascino.identity.application.query;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.common.security.Role;
import tn.damascino.identity.domain.AccountRepository;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

@Component
public class ListStaffAccountsHandler implements QueryHandler<ListStaffAccountsQuery, List<AccountView>> {

    private final AccountRepository accounts;
    private final Clock clock;

    public ListStaffAccountsHandler(AccountRepository accounts, Clock clock) {
        this.accounts = accounts;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public List<AccountView> handle(ListStaffAccountsQuery query) {
        List<Role> roles = query.role() == null || query.role() == Role.BENEFICIARY
                ? List.of(Role.ADMIN, Role.STAFF) : List.of(query.role());
        Instant now = clock.instant();
        return accounts.findByRoleInOrderByDisplayNameAsc(roles).stream().map(a -> AccountView.of(a, now)).toList();
    }
}
