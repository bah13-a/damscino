package tn.damascino.identity.application;

import org.junit.jupiter.api.Test;
import tn.damascino.common.security.Role;
import tn.damascino.common.web.ApiException;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ClientPolicyTest {

    private final ClientPolicy policy = new ClientPolicy(true);

    @Test
    void beneficiariesAndStaffSignInFromTheAppOnly() {
        assertThatThrownBy(() -> policy.checkLogin(Role.BENEFICIARY, null))
                .isInstanceOf(ApiException.class).hasMessageContaining("application mobile");
        assertThatThrownBy(() -> policy.checkLogin(Role.STAFF, "Mozilla/5.0")).isInstanceOf(ApiException.class);
        assertThatCode(() -> policy.checkLogin(Role.BENEFICIARY, "damascino-mobile/1.0.0")).doesNotThrowAnyException();
        assertThatCode(() -> policy.checkLogin(Role.STAFF, "damascino-mobile/1.0.0")).doesNotThrowAnyException();
    }

    @Test
    void theAdministrationStaysOnTheWeb() {
        assertThatCode(() -> policy.checkLogin(Role.ADMIN, null)).doesNotThrowAnyException();
    }

    @Test
    void canBeDisabled() {
        assertThatCode(() -> new ClientPolicy(false).checkLogin(Role.BENEFICIARY, null)).doesNotThrowAnyException();
    }
}
