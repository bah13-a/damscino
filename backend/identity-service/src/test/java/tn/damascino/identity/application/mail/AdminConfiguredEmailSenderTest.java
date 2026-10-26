package tn.damascino.identity.application.mail;

import org.junit.jupiter.api.Test;
import tn.damascino.identity.domain.MailSettings;
import tn.damascino.identity.domain.MailSettingsRepository;

import java.net.ServerSocket;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminConfiguredEmailSenderTest {

    private final MailSettingsRepository repository = mock(MailSettingsRepository.class);
    private final MailSettingsVault vault = new MailSettingsVault("a-test-secret-of-at-least-32-characters");
    private final EmailSender server = mock(EmailSender.class);
    private final AdminConfiguredEmailSender sender = new AdminConfiguredEmailSender(repository, vault, server, "D");

    @Test
    void withoutAdminSettingsTheServerConfigurationSends() {
        when(repository.current()).thenReturn(Optional.empty());
        when(server.send("a@b.tn", "s", "t")).thenReturn(true);
        when(server.simulated()).thenReturn(true);

        assertThat(sender.send("a@b.tn", "s", "t")).isTrue();
        assertThat(sender.simulated()).isTrue();
    }

    @Test
    void adminSettingsTakePrecedenceAndAreReallySent() throws Exception {
        int closed;
        try (ServerSocket socket = new ServerSocket(0)) {
            closed = socket.getLocalPort();
        }
        when(repository.current()).thenReturn(Optional.of(new MailSettings("127.0.0.1", closed, "a@gmail.com",
                vault.encrypt("secret"), "a@gmail.com", "Admin", Instant.now())));

        assertThat(sender.send("a@b.tn", "s", "t")).isFalse();
        assertThat(sender.simulated()).isFalse();
        verify(server, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    void unreadablePasswordIsNotSent() {
        when(repository.current()).thenReturn(Optional.of(new MailSettings("smtp.gmail.com", 587, "a@gmail.com",
                new MailSettingsVault("another-secret-of-at-least-32-characters!").encrypt("x"), "a@gmail.com",
                "Admin", Instant.now())));

        assertThat(sender.send("a@b.tn", "s", "t")).isFalse();
        verify(server, never()).send(anyString(), anyString(), anyString());
    }
}
