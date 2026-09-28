package tn.damascino.identity.application.sms;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import tn.damascino.common.web.ApiException;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AndroidGatewaySmsSenderTest {

    private HttpServer server;

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private String start(int status, AtomicReference<String> body, AtomicReference<String> auth) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/3rdparty/v1/message", exchange -> {
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            exchange.sendResponseHeaders(status, -1);
            exchange.close();
        });
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/3rdparty/v1/";
    }

    @Test
    void postsTheMessageWithBasicAuthentication() throws Exception {
        AtomicReference<String> body = new AtomicReference<>();
        AtomicReference<String> auth = new AtomicReference<>();
        String url = start(202, body, auth);

        new AndroidGatewaySmsSender(url, "user", "secret").send("+21698123456", "code 123456");

        assertThat(body.get()).contains("\"phoneNumbers\":[\"+21698123456\"]").contains("\"text\":\"code 123456\"");
        assertThat(auth.get()).isEqualTo("Basic dXNlcjpzZWNyZXQ=");
    }

    @Test
    void gatewayFailureIsReportedAsUnavailable() throws Exception {
        String url = start(500, new AtomicReference<>(), new AtomicReference<>());

        assertThatThrownBy(() -> new AndroidGatewaySmsSender(url, "user", "secret").send("+21698123456", "x"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("SMS");
    }

    @Test
    void missingCredentialsDoNotPreventStartingButRefuseToSend() throws Exception {
        server = HttpServer.create();
        AndroidGatewaySmsSender sender = new AndroidGatewaySmsSender("https://api.sms-gate.app/3rdparty/v1", "", "");
        assertThatThrownBy(() -> sender.send("+21698123456", "x")).isInstanceOf(ApiException.class);
    }
}
