package tn.damascino.partner.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CredentialVaultTest {

    @Test
    void encryptsAndDecryptsTemporaryPasswords() {
        CredentialVault vault = new CredentialVault("a-long-enough-test-secret");
        String password = TemporaryPasswords.generate();

        String cipher = vault.encrypt(password);

        assertThat(cipher).doesNotContain(password);
        assertThat(vault.decrypt(cipher)).isEqualTo(password);
    }

    @Test
    void temporaryPasswordsContainLettersAndDigits() {
        for (int i = 0; i < 200; i++) {
            String password = TemporaryPasswords.generate();
            assertThat(password).hasSize(10).containsPattern("[A-Za-z]").containsPattern("[2-9]");
        }
    }
}
