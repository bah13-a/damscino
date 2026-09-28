package tn.damascino.identity.domain;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AccountTest {

    private final Instant now = Instant.parse("2026-09-23T10:00:00Z");

    private Account beneficiary() {
        return Account.beneficiary(UUID.randomUUID(), UUID.randomUUID(), "98123456", "Amira Ben Salah", "hash", true, now);
    }

    @Test
    void locksAfterFiveFailedAttempts() {
        Account account = beneficiary();
        for (int i = 0; i < 4; i++) {
            account.registerFailedLogin(now, 5, Duration.ofMinutes(15));
        }
        assertThat(account.isLocked(now)).isFalse();

        account.registerFailedLogin(now, 5, Duration.ofMinutes(15));

        assertThat(account.isLocked(now)).isTrue();
        assertThat(account.isLocked(now.plus(Duration.ofMinutes(16)))).isFalse();
    }

    @Test
    void everyBeneficiaryLoginOpensANewSessionVersion() {
        Account account = beneficiary();
        account.registerSuccessfulLogin(now);
        long first = account.getSessionVersion();

        account.registerSuccessfulLogin(now);

        assertThat(account.getSessionVersion()).isEqualTo(first + 1);
    }

    @Test
    void firstPasswordChangeActivatesTheAccount() {
        Account account = beneficiary();
        assertThat(account.isMustChangePassword()).isTrue();

        assertThat(account.changePassword("new-hash", now)).isTrue();
        assertThat(account.changePassword("other-hash", now)).isFalse();
        assertThat(account.getActivatedAt()).isEqualTo(now);
        assertThat(account.isMustChangePassword()).isFalse();
    }

    @Test
    void temporaryPasswordRevokesSessionsAndForcesChange() {
        Account account = beneficiary();
        account.changePassword("personal", now);
        long version = account.getSessionVersion();

        account.issueTemporaryPassword("temp");

        assertThat(account.isMustChangePassword()).isTrue();
        assertThat(account.getSessionVersion()).isEqualTo(version + 1);
    }

    @Test
    void smsSignInActivatesAndRetiresTheTemporaryPassword() {
        Account account = beneficiary();
        long before = account.getSessionVersion();

        assertThat(account.signInBySms("unusable", now)).isTrue();

        assertThat(account.getActivatedAt()).isEqualTo(now);
        assertThat(account.isMustChangePassword()).isFalse();
        assertThat(account.getPasswordHash()).isEqualTo("unusable");
        assertThat(account.getSessionVersion()).isGreaterThan(before);
        // a later sign-in (new phone) is not a new activation
        assertThat(account.signInBySms("other", now.plusSeconds(60))).isFalse();
        assertThat(account.getPasswordHash()).isEqualTo("unusable");
    }
}
