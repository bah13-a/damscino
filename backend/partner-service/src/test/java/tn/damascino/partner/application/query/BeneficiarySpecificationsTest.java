package tn.damascino.partner.application.query;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BeneficiarySpecificationsTest {

    @Test
    void onlyNumericTokensSearchThePhone() {
        assertThat(BeneficiarySpecifications.isPhoneFragment("98123456")).isTrue();
        assertThat(BeneficiarySpecifications.isPhoneFragment("+216")).isTrue();
        assertThat(BeneficiarySpecifications.isPhoneFragment("98-123")).isTrue();
        // a name containing a digit must not match every phone containing that digit
        assertThat(BeneficiarySpecifications.isPhoneFragment("mansourh1hos")).isFalse();
        assertThat(BeneficiarySpecifications.isPhoneFragment("ben")).isFalse();
        assertThat(BeneficiarySpecifications.isPhoneFragment("+")).isFalse();
    }
}
