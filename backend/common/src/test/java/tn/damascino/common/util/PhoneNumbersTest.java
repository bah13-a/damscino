package tn.damascino.common.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PhoneNumbersTest {

    @Test
    void stripsFormattingAndCountryCode() {
        assertThat(PhoneNumbers.normalize("+216 98 123 456")).isEqualTo("98123456");
        assertThat(PhoneNumbers.normalize("00216-98-123-456")).isEqualTo("98123456");
        assertThat(PhoneNumbers.normalize("98.12.34.56")).isEqualTo("98123456");
    }

    @Test
    void validatesEightDigits() {
        assertThat(PhoneNumbers.isValid("98123456")).isTrue();
        assertThat(PhoneNumbers.isValid("9812345")).isFalse();
    }
}
