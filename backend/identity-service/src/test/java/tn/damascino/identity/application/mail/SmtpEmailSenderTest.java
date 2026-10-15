package tn.damascino.identity.application.mail;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

class SmtpEmailSenderTest {

    private ServerSocket server;

    @AfterEach
    void stop() throws Exception {
        server.close();
    }

    /** Minimal SMTP server (no TLS, no authentication) returning the raw DATA it received. */
    private CompletableFuture<String> smtpServer() throws Exception {
        server = new ServerSocket(0);
        return CompletableFuture.supplyAsync(() -> {
            try (Socket socket = server.accept();
                 BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
                 PrintWriter out = new PrintWriter(socket.getOutputStream(), true, StandardCharsets.UTF_8)) {
                out.print("220 test\r\n");
                out.flush();
                StringBuilder data = new StringBuilder();
                String line;
                while ((line = in.readLine()) != null) {
                    String command = line.toUpperCase();
                    if (command.startsWith("EHLO") || command.startsWith("HELO")) {
                        out.print("250-test\r\n250 8BITMIME\r\n");
                    } else if (command.startsWith("DATA")) {
                        out.print("354 go\r\n");
                        out.flush();
                        while (!(line = in.readLine()).equals(".")) {
                            data.append(line).append("\r\n");
                        }
                        out.print("250 queued\r\n");
                    } else if (command.startsWith("QUIT")) {
                        out.print("221 bye\r\n");
                        out.flush();
                        break;
                    } else {
                        out.print("250 ok\r\n");
                    }
                    out.flush();
                }
                return data.toString();
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        });
    }

    @Test
    void sendsAUtf8MessageThroughSmtp() throws Exception {
        CompletableFuture<String> received = smtpServer();
        SmtpEmailSender sender = new SmtpEmailSender("127.0.0.1", server.getLocalPort(), "", "",
                "codes@damascino.tn", "Damascino Privilèges");

        assertThat(sender.send("amira@exemple.tn", "Votre code : 123456", "Code d'activation : 123456 — é")).isTrue();

        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()),
                new ByteArrayInputStream(received.get(10, TimeUnit.SECONDS).getBytes(StandardCharsets.UTF_8)));
        assertThat(message.getSubject()).isEqualTo("Votre code : 123456");
        jakarta.mail.internet.InternetAddress from = (jakarta.mail.internet.InternetAddress) message.getFrom()[0];
        assertThat(from.getAddress()).isEqualTo("codes@damascino.tn");
        assertThat(from.getPersonal()).isEqualTo("Damascino Privilèges");
        assertThat(message.getAllRecipients()[0].toString()).isEqualTo("amira@exemple.tn");
        assertThat(message.getContent().toString()).contains("Code d'activation : 123456 — é");
    }

    @Test
    void unreachableServerOrMissingSettingsReturnFalse() throws Exception {
        server = new ServerSocket(0);
        int closedPort = server.getLocalPort();
        server.close();

        assertThat(new SmtpEmailSender("127.0.0.1", closedPort, "", "", "codes@damascino.tn", "D")
                .send("amira@exemple.tn", "s", "t")).isFalse();
        assertThat(new SmtpEmailSender("", 587, "", "", "", "D").send("amira@exemple.tn", "s", "t")).isFalse();
    }
}
