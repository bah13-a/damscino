package tn.damascino.identity.application;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tn.damascino.common.security.JwtService;
import tn.damascino.common.security.Secrets;
import tn.damascino.identity.domain.Account;
import tn.damascino.identity.domain.RefreshSession;
import tn.damascino.identity.domain.RefreshSessionRepository;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/** Opens a device session: short-lived access token + long-lived, rotated refresh token. */
@Component
public class TokenIssuer {

    private final JwtService jwtService;
    private final RefreshSessionRepository sessions;
    private final Clock clock;
    private final Duration accessTtl;
    private final Duration beneficiaryTtl;
    private final Duration staffTtl;
    private final Duration adminTtl;

    public TokenIssuer(JwtService jwtService, RefreshSessionRepository sessions, Clock clock,
                       @Value("${damascino.jwt.access-ttl}") Duration accessTtl,
                       @Value("${damascino.sessions.beneficiary-ttl}") Duration beneficiaryTtl,
                       @Value("${damascino.sessions.staff-ttl}") Duration staffTtl,
                       @Value("${damascino.sessions.admin-ttl}") Duration adminTtl) {
        this.jwtService = jwtService;
        this.sessions = sessions;
        this.clock = clock;
        this.accessTtl = accessTtl;
        this.beneficiaryTtl = beneficiaryTtl;
        this.staffTtl = staffTtl;
        this.adminTtl = adminTtl;
    }

    public AuthResult open(Account account, String userAgent) {
        Instant now = clock.instant();
        String refreshToken = Secrets.randomToken(32);
        sessions.save(new RefreshSession(account.getId(), Secrets.sha256Hex(refreshToken),
                now.plus(sessionTtl(account)), now, userAgent));
        return new AuthResult(
                jwtService.issue(account.toPrincipal(), accessTtl),
                refreshToken,
                accessTtl.toSeconds(),
                account.getId(),
                account.getRole(),
                account.getDisplayName(),
                account.isMustChangePassword());
    }

    private Duration sessionTtl(Account account) {
        return switch (account.getRole()) {
            case BENEFICIARY -> beneficiaryTtl;
            case STAFF -> staffTtl;
            case ADMIN -> adminTtl;
        };
    }
}
