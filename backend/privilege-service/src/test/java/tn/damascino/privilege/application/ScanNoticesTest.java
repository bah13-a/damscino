package tn.damascino.privilege.application;

import org.junit.jupiter.api.Test;
import tn.damascino.privilege.domain.RefusalReason;

import static org.assertj.core.api.Assertions.assertThat;

class ScanNoticesTest {

    @Test
    void everyRefusalHasAMessageForTheCustomer() {
        for (RefusalReason reason : RefusalReason.values()) {
            assertThat(ScanNotices.messageFor(reason)).isNotBlank();
        }
    }

    @Test
    void cashierInstructionsAreRewordedForTheCustomer() {
        assertThat(ScanNotices.messageFor(RefusalReason.QR_EXPIRED)).doesNotContain("demandez au client");
        assertThat(ScanNotices.messageFor(RefusalReason.RESERVATION_EXPIRED)).contains("scanner à nouveau votre code");
        assertThat(ScanNotices.messageFor(RefusalReason.QUOTA_REACHED)).isEqualTo(RefusalReason.QUOTA_REACHED.message());
    }
}
