package tn.damascino.identity.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.security.Role;
import tn.damascino.identity.domain.Account;
import tn.damascino.identity.domain.AccountRepository;

import java.time.Clock;
import java.util.Locale;

/** Creates the super-administrator on first start (password change forced at first login). */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final AccountRepository accounts;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final String username;
    private final String password;

    public AdminBootstrap(AccountRepository accounts, PasswordEncoder passwordEncoder, Clock clock,
                          @Value("${damascino.bootstrap.admin-username}") String username,
                          @Value("${damascino.bootstrap.admin-password}") String password) {
        this.accounts = accounts;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.username = username.trim().toLowerCase(Locale.ROOT);
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (accounts.existsByRole(Role.ADMIN)) {
            return;
        }
        accounts.save(Account.staff(Role.ADMIN, username, "Super administrateur", passwordEncoder.encode(password),
                clock.instant()));
        log.warn("Super-administrator '{}' created; its password must be changed at first login", username);
    }
}
