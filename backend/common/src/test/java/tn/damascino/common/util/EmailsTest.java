package tn.damascino.common.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EmailsTest {

    @Test
    void normalizesAndAcceptsEmpty() {
        assertThat(Emails.normalize("  Amira@Exemple.TN ")).isEqualTo("amira@exemple.tn");
        assertThat(Emails.normalize("  ")).isNull();
        assertThat(Emails.isValidOrEmpty(null)).isTrue();
        assertThat(Emails.isValidOrEmpty("amira@exemple.tn")).isTrue();
    }

    @Test
    void rejectsMalformedAddresses() {
        assertThat(Emails.isValidOrEmpty("amira")).isFalse();
        assertThat(Emails.isValidOrEmpty("amira@exemple")).isFalse();
        assertThat(Emails.isValidOrEmpty("a b@exemple.tn")).isFalse();
        assertThat(Emails.isValidOrEmpty("<script>@x.tn")).isFalse();
    }

    @Test
    void masksTheLocalPart() {
        assertThat(Emails.mask("amira@exemple.tn")).isEqualTo("a•••@exemple.tn");
    }
}
