package tn.damascino.identity.application.command;

import org.junit.jupiter.api.Test;
import tn.damascino.common.web.ApiException;
import tn.damascino.identity.application.mail.EmailSender;
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
    private final EmailSender mail = mock(EmailSender.class);

    private RequestSmsCodeHandler handler(SmsSender sender, int maxPerIp) {
        return handler(sender, maxPerIp, null);
    }

    private RequestSmsCodeHandler handler(SmsSender sender, int maxPerIp, String email) {
        Account account = Account.beneficiary(UUID.randomUUID(), partnerId, "98123456", "Amira", "hash", true, now);
        account.changeEmail(email);
        when(accounts.findByUsername("98123456")).thenReturn(Optional.of(account));
        when(codes.findFirstByPhoneOrderByCreatedAtDesc(anyString())).thenReturn(Optional.empty());
        when(codes.findByPhoneAndConsumedFalse(anyString())).thenReturn(List.of());
        return new RequestSmsCodeHandler(accounts, codes, sender, mail, new SmsRateLimiter(clock, maxPerIp), clock,
                Duration.ofMinutes(5), Duration.ofSeconds(60), 3, true);
    }

    private static ApiException smsDown() {
        return new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "SMS_UNAVAILABLE",
                "L'envoi du SMS a échoué.");
    }

    @Test
    void emailIsTheMainChannelWhenTheListGivesAnAddress() {
        SmsSender sender = mock(SmsSender.class);
        when(mail.send(anyString(), anyString(), anyString())).thenReturn(true);
        org.mockito.ArgumentCaptor<String> subject = org.mockito.ArgumentCaptor.forClass(String.class);

        RequestSmsCodeCommand.Sent sent = handler(sender, 10, "amira@exemple.tn")
                .handle(new RequestSmsCodeCommand("98123456", null, "1.1.1.1"));

        verify(mail).send(eq("amira@exemple.tn"), subject.capture(), org.mockito.ArgumentMatchers.contains("est : "));
        assertThat(subject.getValue()).matches(".*: \\d{6}");
        verify(sender, never()).send(anyString(), anyString());
        assertThat(sent.smsSent()).isFalse();
        assertThat(sent.maskedEmail()).isEqualTo("a•••@exemple.tn");
        assertThat(sent.devCode()).isNull();
    }

    @Test
    void smsIsTheBackupWhenTheEmailFails() {
        SmsSender sender = mock(SmsSender.class);
        when(mail.send(anyString(), anyString(), anyString())).thenReturn(false);

        RequestSmsCodeCommand.Sent sent = handler(sender, 10, "amira@exemple.tn")
                .handle(new RequestSmsCodeCommand("98123456", null, "1.1.1.1"));

        verify(sender).send(eq("+21698123456"), org.mockito.ArgumentMatchers.matches(".*code est \\d{6}\\..*"));
        assertThat(sent.smsSent()).isTrue();
        assertThat(sent.maskedEmail()).isNull();
    }

    @Test
    void failsWhenNoChannelDeliveredTheCode() {
        SmsSender sender = mock(SmsSender.class);
        org.mockito.Mockito.doThrow(smsDown()).when(sender).send(anyString(), anyString());
        when(mail.send(anyString(), anyString(), anyString())).thenReturn(false);

        assertThatThrownBy(() -> handler(sender, 10, "amira@exemple.tn")
                .handle(new RequestSmsCodeCommand("98123456", null, "1.1.1.1")))
                .isInstanceOf(ApiException.class).hasMessageContaining("envoi du code par e-mail a échoué");
        // without an e-mail on the account, the beneficiary is told what is missing
        assertThatThrownBy(() -> handler(sender, 10, null).handle(new RequestSmsCodeCommand("98123456", null, "1.1.1.1")))
                .isInstanceOf(ApiException.class).hasMessageContaining("Aucune adresse e-mail n'est enregistrée");
    }

    @Test
    void codeIsOnlyExposedWhenTheChannelUsedIsSimulated() {
        SmsSender sender = mock(SmsSender.class);
        when(sender.simulated()).thenReturn(true);
        when(mail.send(anyString(), anyString(), anyString())).thenReturn(true);

        // a real e-mail left: never shown in the app, even though the SMS sender is simulated
        assertThat(handler(sender, 10, "amira@exemple.tn")
                .handle(new RequestSmsCodeCommand("98123456", null, "1.1.1.1")).devCode()).isNull();
        when(mail.simulated()).thenReturn(true);
        assertThat(handler(sender, 10, "amira@exemple.tn")
                .handle(new RequestSmsCodeCommand("98123456", null, "1.1.1.1")).devCode()).matches("\\d{6}");
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
