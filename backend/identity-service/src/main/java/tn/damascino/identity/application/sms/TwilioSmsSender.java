package tn.damascino.identity.application.sms;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import tn.damascino.common.web.ApiException;

import java.time.Duration;

/**
 * Sends through Twilio (paid, professional): no phone to maintain, sender name "DAMASCINO" (alphanumeric sender ID)
 * or a Twilio number, or a Messaging Service that chooses the sender.
 */
public class TwilioSmsSender implements SmsSender {

    private static final Logger log = LoggerFactory.getLogger(TwilioSmsSender.class);

    private final RestClient client;
    private final String accountSid;
    private final String from;
    private final String messagingServiceSid;
    private final boolean configured;

    public TwilioSmsSender(String apiUrl, String accountSid, String authToken, String from, String messagingServiceSid) {
        this.accountSid = blankToNull(accountSid);
        this.from = blankToNull(from);
        this.messagingServiceSid = blankToNull(messagingServiceSid);
        // the service starts without credentials (first installation); sending then fails with a clear log line
        this.configured = this.accountSid != null && blankToNull(authToken) != null
                && (this.from != null || this.messagingServiceSid != null);
        if (!configured) {
            log.warn("SMS Twilio non configuré : renseigner TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_FROM "
                    + "(ou TWILIO_MESSAGING_SERVICE_SID) (docs/SMS.md)");
        }
        SimpleClientHttpRequestFactory timeouts = new SimpleClientHttpRequestFactory();
        timeouts.setConnectTimeout(Duration.ofSeconds(5));
        timeouts.setReadTimeout(Duration.ofSeconds(15));
        this.client = RestClient.builder()
                .baseUrl(apiUrl == null || apiUrl.isBlank() ? "https://api.twilio.com" : apiUrl.replaceAll("/+$", ""))
                .requestFactory(timeouts)
                .defaultHeaders(h -> h.setBasicAuth(accountSid == null ? "" : accountSid, authToken == null ? "" : authToken))
                .build();
    }

    @Override
    public void send(String phone, String text) {
        if (!configured) {
            log.warn("SMS non envoyé vers {} : identifiants Twilio manquants", phone);
            throw unavailable();
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("To", phone);
        form.add("Body", text);
        if (messagingServiceSid != null) {
            form.add("MessagingServiceSid", messagingServiceSid);
        } else {
            form.add("From", from);
        }
        try {
            client.post().uri("/2010-04-01/Accounts/{sid}/Messages.json", accountSid)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            // Twilio explains the refusal in the body, e.g. 21408 (country not enabled) or 21211 (invalid number)
            log.warn("Twilio a refusé le SMS vers {} : HTTP {} {}", phone, e.getStatusCode().value(),
                    e.getResponseBodyAsString());
            throw unavailable();
        } catch (RestClientException e) {
            log.warn("Envoi SMS Twilio impossible vers {} : {}", phone, e.getMessage());
            throw unavailable();
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "SMS_UNAVAILABLE",
                "L'envoi du SMS a échoué. Réessayez dans quelques minutes.");
    }
}
