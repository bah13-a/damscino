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

/**
 * Creates the super-administrator on first start (password change forced at first login). With
 * {@code ADMIN_RESET=true}, an existing super-administrator gets the initial password back, unlocked and
 * reactivated (recovery when the password is lost or the account is locked).
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final AccountRepository accounts;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final String username;
    private final String password;
    private final boolean reset;

    public AdminBootstrap(AccountRepository accounts, PasswordEncoder passwordEncoder, Clock clock,
                          @Value("${damascino.bootstrap.admin-username}") String username,
                          @Value("${damascino.bootstrap.admin-password}") String password,
                          @Value("${damascino.bootstrap.admin-reset:false}") boolean reset) {
        this.accounts = accounts;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.username = username.trim().toLowerCase(Locale.ROOT);
        this.password = password;
        this.reset = reset;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (reset) {
            accounts.findByUsername(username).filter(a -> a.getRole() == Role.ADMIN).ifPresent(admin -> {
                admin.issueTemporaryPassword(passwordEncoder.encode(password));
                admin.setActive(true);
                accounts.save(admin);
                log.warn("Super-administrator '{}' reset to the initial password (ADMIN_RESET): remove ADMIN_RESET "
                        + "and restart", username);
            });
        }
        if (accounts.existsByRole(Role.ADMIN)) {
            return;
        }
        accounts.save(Account.staff(Role.ADMIN, username, "Super administrateur", passwordEncoder.encode(password),
                clock.instant()));
        log.warn("Super-administrator '{}' created; its password must be changed at first login", username);
    }
}
