package tn.damascino.identity.application.sms;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import tn.damascino.common.web.ApiException;

import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TwilioSmsSenderTest {

    private HttpServer server;
    private final AtomicReference<String> path = new AtomicReference<>();
    private final AtomicReference<String> body = new AtomicReference<>();
    private final AtomicReference<String> auth = new AtomicReference<>();
    private final AtomicReference<String> contentType = new AtomicReference<>();

    @AfterEach
    void stop() {
        if (server != null) {
            server.stop(0);
        }
    }

    private String start(int status, String response) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/2010-04-01/Accounts/", exchange -> {
            path.set(exchange.getRequestURI().getPath());
            body.set(URLDecoder.decode(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8),
                    StandardCharsets.UTF_8));
            auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            contentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @Test
    void postsTheMessageToTheAccountWithBasicAuthentication() throws Exception {
        String url = start(201, "{\"sid\":\"SM123\",\"status\":\"queued\"}");

        new TwilioSmsSender(url, "AC123", "token", "DAMASCINO", "").send("+21698123456", "code 123456");

        assertThat(path.get()).isEqualTo("/2010-04-01/Accounts/AC123/Messages.json");
        assertThat(contentType.get()).startsWith("application/x-www-form-urlencoded");
        assertThat(body.get()).contains("To=+21698123456").contains("Body=code 123456").contains("From=DAMASCINO")
                .doesNotContain("MessagingServiceSid");
        assertThat(auth.get()).isEqualTo("Basic QUMxMjM6dG9rZW4=");
    }

    @Test
    void messagingServiceIsUsedInsteadOfASender() throws Exception {
        String url = start(201, "{\"sid\":\"SM123\"}");

        new TwilioSmsSender(url, "AC123", "token", "", "MG456").send("+21698123456", "x");

        assertThat(body.get()).contains("MessagingServiceSid=MG456").doesNotContain("From=");
    }

    @Test
    void refusalIsReportedAsUnavailable() throws Exception {
        String url = start(400, "{\"code\":21408,\"message\":\"Permission to send an SMS has not been enabled\"}");

        assertThatThrownBy(() -> new TwilioSmsSender(url, "AC123", "token", "DAMASCINO", "").send("+21698123456", "x"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("SMS");
    }

    @Test
    void missingCredentialsDoNotPreventStartingButRefuseToSend() {
        TwilioSmsSender noToken = new TwilioSmsSender("", "AC123", "", "DAMASCINO", "");
        TwilioSmsSender noSender = new TwilioSmsSender("", "AC123", "token", "", "");

        assertThatThrownBy(() -> noToken.send("+21698123456", "x")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> noSender.send("+21698123456", "x")).isInstanceOf(ApiException.class);
    }
}
