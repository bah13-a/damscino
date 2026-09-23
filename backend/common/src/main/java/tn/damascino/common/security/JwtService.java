package tn.damascino.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

/** Issues (identity service) and verifies (every service) HS256 access tokens. */
@Component
public class JwtService {

    private static final String ISSUER = "damascino-privileges";

    private final SecretKey key;
    private final Clock clock;

    public JwtService(@Value("${damascino.jwt.secret}") String secret, Clock clock) {
        this.key = Keys.hmacShaKeyFor(Secrets.deriveKey(secret));
        this.clock = clock;
    }

    public String issue(AuthenticatedUser user, Duration ttl) {
        Instant now = clock.instant();
        var builder = Jwts.builder()
                .issuer(ISSUER)
                .subject(user.accountId().toString())
                .claim("role", user.role().name())
                .claim("name", user.displayName())
                .claim("sv", user.sessionVersion())
                .claim("pwc", user.passwordChangeRequired())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)));
        if (user.beneficiaryId() != null) {
            builder.claim("bid", user.beneficiaryId().toString());
        }
        return builder.signWith(key).compact();
    }

    public Optional<AuthenticatedUser> verify(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(ISSUER)
                    .clock(() -> Date.from(clock.instant()))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            String bid = claims.get("bid", String.class);
            Number sv = claims.get("sv", Number.class);
            Boolean pwc = claims.get("pwc", Boolean.class);
            return Optional.of(new AuthenticatedUser(
                    UUID.fromString(claims.getSubject()),
                    Role.valueOf(claims.get("role", String.class)),
                    claims.get("name", String.class),
                    bid == null ? null : UUID.fromString(bid),
                    sv == null ? 0 : sv.longValue(),
                    Boolean.TRUE.equals(pwc)));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
