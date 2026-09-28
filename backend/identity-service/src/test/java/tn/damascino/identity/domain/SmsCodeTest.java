package tn.damascino.identity.domain;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class SmsCodeTest {

    private final Instant now = Instant.parse("2026-09-28T10:00:00Z");

    private SmsCode code() {
        return new SmsCode(UUID.randomUUID(), "98123456", "123456", Duration.ofMinutes(5), "10.0.0.1", now);
    }

    @Test
    void validCodeIsAcceptedOnce() {
        SmsCode code = code();
        assertThat(code.verify("123456", now.plusSeconds(30), 3)).isEqualTo(SmsCode.Check.VALID);
        assertThat(code.verify("123456", now.plusSeconds(31), 3)).isEqualTo(SmsCode.Check.EXPIRED);
    }

    @Test
    void codeExpiresAfterFiveMinutes() {
        SmsCode code = code();
        assertThat(code.verify("123456", now.plus(Duration.ofMinutes(5)), 3)).isEqualTo(SmsCode.Check.EXPIRED);
    }

    @Test
    void thirdWrongAnswerBlocksTheCode() {
        SmsCode code = code();
        assertThat(code.verify("000000", now, 3)).isEqualTo(SmsCode.Check.WRONG);
        assertThat(code.remainingAttempts(3)).isEqualTo(2);
        assertThat(code.verify("111111", now, 3)).isEqualTo(SmsCode.Check.WRONG);
        assertThat(code.verify("222222", now, 3)).isEqualTo(SmsCode.Check.TOO_MANY_ATTEMPTS);
        // even the right code is refused once blocked
        assertThat(code.verify("123456", now, 3)).isEqualTo(SmsCode.Check.TOO_MANY_ATTEMPTS);
    }

    @Test
    void invalidatedCodeIsRefused() {
        SmsCode code = code();
        code.invalidate();
        assertThat(code.verify("123456", now, 3)).isEqualTo(SmsCode.Check.EXPIRED);
    }
}
