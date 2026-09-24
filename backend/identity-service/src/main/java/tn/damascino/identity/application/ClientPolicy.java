package tn.damascino.identity.application;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tn.damascino.common.security.Role;
import tn.damascino.common.web.ApiException;

/**
 * Beneficiaries and till staff use the Damascino Privilèges mobile app; only the administration signs in on the
 * web. The app announces itself with the {@value #HEADER} header on every call.
 */
@Component
public class ClientPolicy {

    public static final String HEADER = "X-Client-App";
    static final String MOBILE_PREFIX = "damascino-mobile/";

    private final boolean mobileOnly;

    public ClientPolicy(@Value("${security.mobile-only-spaces:true}") boolean mobileOnly) {
        this.mobileOnly = mobileOnly;
    }

    public void checkLogin(Role space, String clientApp) {
        boolean fromApp = clientApp != null && clientApp.startsWith(MOBILE_PREFIX);
        if (mobileOnly && space != Role.ADMIN && !fromApp) {
            throw new ApiException(HttpStatus.FORBIDDEN, "MOBILE_APP_REQUIRED",
                    "Connectez-vous depuis l'application mobile Damascino Privilèges.");
        }
    }
}
