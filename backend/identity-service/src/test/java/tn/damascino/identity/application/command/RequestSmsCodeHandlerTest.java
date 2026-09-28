package tn.damascino.identity.application.command;

import org.junit.jupiter.api.Test;
import tn.damascino.common.web.ApiException;
import tn.damascino.identity.application.sms.SmsRateLimiter;
import tn.damascino.identity.application.sms.SmsSender;
import tn.damascino.identity.domain.Account;
import tn.damascino.identity.domain.AccountRepository;
import tn.damascino.identity.domain.SmsCodeRepository;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RequestSmsCodeHandlerTest {

    private final Instant now = Instant.parse("2026-09-28T10:00:00Z");
    private final Clock clock = Clock.fixed(now, ZoneOffset.UTC);
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final SmsCodeRepository codes = mock(SmsCodeRepository.class);
    private final UUID partnerId = UUID.randomUUID();

    private RequestSmsCodeHandler handler(SmsSender sender, int maxPerIp) {
        Account account = Account.beneficiary(UUID.randomUUID(), partnerId, "98123456", "Amira", "hash", true, now);
        when(accounts.findByUsername("98123456")).thenReturn(Optional.of(account));
        when(codes.findFirstByPhoneOrderByCreatedAtDesc(anyString())).thenReturn(Optional.empty());
        when(codes.findByPhoneAndConsumedFalse(anyString())).thenReturn(List.of());
        return new RequestSmsCodeHandler(accounts, codes, sender, new SmsRateLimiter(clock, maxPerIp), clock,
                Duration.ofMinutes(5), Duration.ofSeconds(60), 3, true);
    }

    @Test
    void sendsASixDigitCodeInInternationalFormat() {
        SmsSender sender = mock(SmsSender.class);
        RequestSmsCodeCommand.Sent sent = handler(sender, 10).handle(new RequestSmsCodeCommand("+216 98 123 456", partnerId, "1.1.1.1"));

        verify(sender).send(eq("+21698123456"), org.mockito.ArgumentMatchers.matches(".*code est \\d{6}\\..*"));
        assertThat(sent.maskedPhone()).isEqualTo("+216 •• ••• 456");
        assertThat(sent.expiresIn()).isEqualTo(300);
        // a real SMS was sent: the code is never returned, even if exposure is enabled by mistake
        assertThat(sent.devCode()).isNull();
    }

    @Test
    void simulatedSenderReturnsTheCodeForTheTestEnvironment() {
        SmsSender sender = mock(SmsSender.class);
        when(sender.simulated()).thenReturn(true);
        assertThat(handler(sender, 10).handle(new RequestSmsCodeCommand("98123456", null, "1.1.1.1")).devCode()).matches("\\d{6}");
    }

    @Test
    void refusesANumberOfAnotherPartner() {
        SmsSender sender = mock(SmsSender.class);
        RequestSmsCodeHandler handler = handler(sender, 10);
        assertThatThrownBy(() -> handler.handle(new RequestSmsCodeCommand("98123456", UUID.randomUUID(), "1.1.1.1")))
                .isInstanceOf(ApiException.class).hasMessageContaining("liste de votre entreprise");
        verify(sender, never()).send(anyString(), anyString());
    }

    @Test
    void limitsTheCodesPerNumberAndPerHour() {
        SmsSender sender = mock(SmsSender.class);
        RequestSmsCodeHandler handler = handler(sender, 10);
        when(codes.countByPhoneAndCreatedAtAfter(eq("98123456"), any())).thenReturn(3L);
        assertThatThrownBy(() -> handler.handle(new RequestSmsCodeCommand("98123456", null, "1.1.1.1")))
                .isInstanceOf(ApiException.class).hasMessageContaining("Nombre maximal");
    }

    @Test
    void limitsTheRequestsPerAddressIncludingRefusedNumbers() {
        SmsSender sender = mock(SmsSender.class);
        RequestSmsCodeHandler handler = handler(sender, 2);
        for (int i = 0; i < 2; i++) {
            assertThatThrownBy(() -> handler.handle(new RequestSmsCodeCommand("22000000", null, "6.6.6.6")))
                    .hasMessageContaining("aucune liste");
        }
        assertThatThrownBy(() -> handler.handle(new RequestSmsCodeCommand("22000001", null, "6.6.6.6")))
                .hasMessageContaining("Trop de demandes");
    }
}
