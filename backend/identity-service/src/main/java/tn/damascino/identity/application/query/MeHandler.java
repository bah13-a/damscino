package tn.damascino.identity.application.query;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.QueryHandler;
import tn.damascino.common.web.ApiException;
import tn.damascino.identity.domain.AccountRepository;

import java.time.Clock;

@Component
public class MeHandler implements QueryHandler<MeQuery, AccountView> {

    private final AccountRepository accounts;
    private final Clock clock;

    public MeHandler(AccountRepository accounts, Clock clock) {
        this.accounts = accounts;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public AccountView handle(MeQuery query) {
        return accounts.findById(query.accountId())
                .map(a -> AccountView.of(a, clock.instant()))
                .orElseThrow(() -> ApiException.notFound("Compte"));
    }
}
