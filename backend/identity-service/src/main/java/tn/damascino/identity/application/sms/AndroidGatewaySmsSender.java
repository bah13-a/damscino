package tn.damascino.identity.application.sms;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tn.damascino.common.web.ApiException;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Sends through "SMS Gateway for Android" (free, open source, sms-gate.app): an Android phone with a Tunisian SIM
 * card sends the messages with its own plan. Works with the phone's local server
 * ({@code http://<phone-ip>:8080}) or with the free cloud relay ({@code https://api.sms-gate.app/3rdparty/v1}).
 */
public class AndroidGatewaySmsSender implements SmsSender {

    private static final Logger log = LoggerFactory.getLogger(AndroidGatewaySmsSender.class);

    private final RestClient client;
    private final boolean configured;

    public AndroidGatewaySmsSender(String url, String username, String password) {
        // the service starts without credentials (first installation); sending then fails with a clear log line
        this.configured = url != null && !url.isBlank() && username != null && !username.isBlank();
        if (!configured) {
            log.warn("SMS non configuré : renseigner SMS_GATEWAY_USER et SMS_GATEWAY_PASSWORD (docs/SMS.md)");
        }
        SimpleClientHttpRequestFactory timeouts = new SimpleClientHttpRequestFactory();
        timeouts.setConnectTimeout(Duration.ofSeconds(5));
        timeouts.setReadTimeout(Duration.ofSeconds(15));
        this.client = RestClient.builder()
                .baseUrl(url == null ? "" : url.replaceAll("/+$", ""))
                .requestFactory(timeouts)
                .defaultHeaders(h -> h.setBasicAuth(username, password == null ? "" : password))
                .build();
    }

    @Override
    public void send(String phone, String text) {
        if (!configured) {
            log.warn("SMS non envoyé vers {} : SMS_GATEWAY_USER / SMS_GATEWAY_PASSWORD manquants", phone);
            throw unavailable();
        }
        try {
            client.post().uri("/message")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("textMessage", Map.of("text", text), "phoneNumbers", List.of(phone)))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException e) {
            log.warn("Envoi SMS impossible vers {} : {}", phone, e.getMessage());
            throw unavailable();
        }
    }

    private static ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "SMS_UNAVAILABLE",
                "L'envoi du SMS a échoué. Réessayez dans quelques minutes.");
    }
}
