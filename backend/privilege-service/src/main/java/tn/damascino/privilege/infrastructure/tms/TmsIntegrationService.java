package tn.damascino.privilege.infrastructure.tms;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Service
public class TmsIntegrationService {

    private static final Logger logger = LoggerFactory.getLogger(TmsIntegrationService.class);

    private final RestTemplate restTemplate;
    private final String tmsUrl;

    public TmsIntegrationService(RestTemplate restTemplate, @Value("${tms.url:}") String tmsUrl) {
        this.restTemplate = restTemplate;
        this.tmsUrl = tmsUrl;
    }

    /**
     * Envoie une notification de réduction à la caisse TMS.
     * La caisse appliquera automatiquement le discount.
     */
    public void sendDiscountNotification(String qrToken, BigDecimal discountPercentage) {
        if (tmsUrl == null || tmsUrl.isBlank()) {
            logger.warn("TMS_URL non configuré - impossible d'envoyer la réduction à la caisse");
            return;
        }

        try {
            var request = Map.of(
                    "qrToken", qrToken,
                    "discountPercentage", discountPercentage.doubleValue(),
                    "discountType", "percentage",
                    "timestamp", Instant.now().toString(),
                    "status", "validated"
            );

            String endpoint = tmsUrl.endsWith("/") ? tmsUrl + "apply-discount" : tmsUrl + "/apply-discount";
            restTemplate.postForObject(endpoint, request, Map.class);
            logger.info("Réduction 20% envoyée à TMS pour QR: {}", qrToken);
        } catch (RestClientException e) {
            logger.error("Erreur lors de l'envoi de la réduction à TMS: {}", e.getMessage(), e);
            // Non-bloquant - la validation réussit même si TMS n'est pas accessible
        }
    }
}
