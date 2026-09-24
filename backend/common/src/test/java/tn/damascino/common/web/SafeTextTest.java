package tn.damascino.common.web;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SafeTextTest {

    record PartnerRequest(String name, List<String> eligibleCategories, String password) {
    }

    private final ObjectMapper mapper = new ObjectMapper().registerModule(new SafeTextJsonConfig().safeTextModule());

    @Test
    void refusesMarkupAndScriptUrls() {
        assertThat(SafeText.containsMarkup("<script>alert(1)</script>")).isTrue();
        assertThat(SafeText.containsMarkup("Café <img src=x onerror=alert(1)>")).isTrue();
        assertThat(SafeText.containsMarkup("</b>")).isTrue();
        assertThat(SafeText.containsMarkup("JavaScript:alert(1)")).isTrue();
        assertThat(SafeText.containsMarkup("Ben Salah-Trabelsi & fils (Sfax)")).isFalse();
        assertThat(SafeText.containsMarkup("Plat < 20 DT")).isFalse();
        assertThat(SafeText.containsMarkup("L'Olivier")).isFalse();
    }

    @Test
    void jsonStringsAreCheckedButSecretsAreLeftUntouched() throws Exception {
        PartnerRequest ok = mapper.readValue("""
                {"name":"Mall\\u202E of Sfax\\u0007","eligibleCategories":["plat"],"password":"<a>b\\u0007"}""",
                PartnerRequest.class);
        assertThat(ok.name()).isEqualTo("Mall of Sfax");
        assertThat(ok.password()).isEqualTo("<a>b\u0007");

        assertThatThrownBy(() -> mapper.readValue("""
                {"name":"<svg onload=alert(1)>"}""", PartnerRequest.class))
                .isInstanceOf(JsonMappingException.class)
                .rootCause().isInstanceOf(SafeText.UnsafeTextException.class)
                .extracting(e -> ((SafeText.UnsafeTextException) e).field()).isEqualTo("name");
        assertThatThrownBy(() -> mapper.readValue("""
                {"eligibleCategories":["<b>x</b>"]}""", PartnerRequest.class))
                .rootCause().extracting(e -> ((SafeText.UnsafeTextException) e).field()).isEqualTo("eligibleCategories");
    }
}
