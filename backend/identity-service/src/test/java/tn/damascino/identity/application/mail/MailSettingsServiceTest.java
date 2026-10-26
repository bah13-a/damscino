package tn.damascino.identity.application.mail;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tn.damascino.common.events.AuditRecorded;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.common.security.Role;
import tn.damascino.common.web.ApiException;
import tn.damascino.identity.domain.MailSettings;
import tn.damascino.identity.domain.MailSettingsRepository;

import java.net.ServerSocket;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MailSettingsServiceTest {

    private final MailSettingsRepository repository = mock(MailSettingsRepository.class);
    private final MailSettingsVault vault = new MailSettingsVault("a-test-secret-of-at-least-32-characters");
    private final EventPublisher events = mock(EventPublisher.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-26T10:00:00Z"), ZoneOffset.UTC);
    private final AuthenticatedUser admin = new AuthenticatedUser(UUID.randomUUID(), Role.ADMIN, "Admin", null, 0, false);

    private MailSettingsService service(String provider) {
        return new MailSettingsService(repository, vault, events, clock, provider, "", "", "", "Damascino Privilèges");
    }

    private MailSettings saved(String password) {
        return new MailSettings("smtp.gmail.com", 587, "damascino@gmail.com", vault.encrypt(password),
                "damascino@gmail.com", "Admin", clock.instant());
    }

    @Test
    void nothingConfiguredProposesGmail() {
        when(repository.current()).thenReturn(Optional.empty());

        MailSettingsService.View view = service("log").view();

        assertThat(view.source()).isEqualTo(MailSettingsService.Source.NONE);
        assertThat(view.host()).isEqualTo("smtp.gmail.com");
        assertThat(view.port()).isEqualTo(587);
        assertThat(view.passwordSet()).isFalse();
    }

    @Test
    void savesAnEncryptedPasswordNeverReturnedAndAudits() {
        when(repository.current()).thenReturn(Optional.empty());
        ArgumentCaptor<MailSettings> stored = ArgumentCaptor.forClass(MailSettings.class);

        service("log").save(admin, new MailSettingsService.Form("", null, " Damascino@Gmail.com ", "abcd efgh ijkl mnop", ""));

        verify(repository).save(stored.capture());
        MailSettings s = stored.getValue();
        assertThat(s.getUsername()).isEqualTo("damascino@gmail.com");
        assertThat(s.getFromAddress()).isEqualTo("damascino@gmail.com");
        assertThat(s.getPasswordCipher()).doesNotContain("abcd");
        // Gmail application passwords are shown with spaces
        assertThat(vault.decrypt(s.getPasswordCipher())).contains("abcdefghijklmnop");
        ArgumentCaptor<AuditRecorded> audit = ArgumentCaptor.forClass(AuditRecorded.class);
        verify(events).publish(audit.capture());
        assertThat(audit.getValue().action()).isEqualTo("MAIL_SETTINGS_UPDATED");
        assertThat(audit.getValue().details()).doesNotContain("abcd");
    }

    @Test
    void emptyPasswordKeepsTheSavedOne() {
        MailSettings existing = saved("oldpassword12345");
        String cipher = existing.getPasswordCipher();
        when(repository.current()).thenReturn(Optional.of(existing));

        MailSettingsService.View view = service("log").save(admin,
                new MailSettingsService.Form("smtp.gmail.com", 587, "damascino@gmail.com", "", "damascino@gmail.com"));

        assertThat(existing.getPasswordCipher()).isEqualTo(cipher);
        assertThat(view.source()).isEqualTo(MailSettingsService.Source.ADMIN);
        assertThat(view.passwordSet()).isTrue();
    }

    @Test
    void refusesInvalidValues() {
        when(repository.current()).thenReturn(Optional.empty());
        MailSettingsService service = service("log");

        assertThatThrownBy(() -> service.save(admin, new MailSettingsService.Form("", null, "pas-un-email", "x", "")))
                .isInstanceOf(ApiException.class).hasMessageContaining("Adresse e-mail");
        assertThatThrownBy(() -> service.save(admin, new MailSettingsService.Form("", null, "a@gmail.com", "", "")))
                .isInstanceOf(ApiException.class).hasMessageContaining("mot de passe");
        assertThatThrownBy(() -> service.save(admin, new MailSettingsService.Form("smtp gmail", null, "a@gmail.com", "x", "")))
                .isInstanceOf(ApiException.class).hasMessageContaining("serveur");
        assertThatThrownBy(() -> service.save(admin, new MailSettingsService.Form("", 70000, "a@gmail.com", "x", "")))
                .isInstanceOf(ApiException.class).hasMessageContaining("Port");
    }

    @Test
    void failedTestExplainsTheCauseInFrench() throws Exception {
        when(repository.current()).thenReturn(Optional.empty());
        int closed;
        try (ServerSocket socket = new ServerSocket(0)) {
            closed = socket.getLocalPort();
        }
        int port = closed;

        assertThatThrownBy(() -> service("log").test(
                new MailSettingsService.Form("127.0.0.1", port, "a@gmail.com", "x", ""), "test@exemple.tn"))
                .isInstanceOf(ApiException.class).hasMessageContaining("injoignable");
        assertThatThrownBy(() -> service("log").test(
                new MailSettingsService.Form("127.0.0.1", port, "a@gmail.com", "x", ""), "pas-un-email"))
                .isInstanceOf(ApiException.class).hasMessageContaining("destinataire");
    }

    @Test
    void resetReturnsToTheServerConfiguration() {
        when(repository.current()).thenReturn(Optional.of(saved("password1234567")), Optional.empty());

        MailSettingsService.View view = service("smtp-but-not-configured").reset(admin);

        verify(repository).delete(any());
        assertThat(view.source()).isEqualTo(MailSettingsService.Source.NONE);
    }
}
