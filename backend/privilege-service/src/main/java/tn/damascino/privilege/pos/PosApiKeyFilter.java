package tn.damascino.privilege.pos;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/** Authenticates calls of the till API ({@code /api/pos/v1/**}) with the {@code X-Api-Key} header. */
public class PosApiKeyFilter extends OncePerRequestFilter {

    private final PosTerminalRepository terminals;
    private final Clock clock;

    public PosApiKeyFilter(PosTerminalRepository terminals, Clock clock) {
        this.terminals = terminals;
        this.clock = clock;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/pos/v1/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String key = request.getHeader(PosApiKeys.HEADER);
        if (key != null && !key.isBlank()) {
            terminals.findByKeyHash(PosApiKeys.hash(key)).filter(PosTerminal::isActive).ifPresent(terminal -> {
                SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                        new PosPrincipal(terminal.getId(), terminal.getName()), null,
                        List.of(new SimpleGrantedAuthority("ROLE_POS"))));
                Instant now = clock.instant();
                if (terminal.getLastUsedAt() == null || terminal.getLastUsedAt().isBefore(now.minus(Duration.ofMinutes(1)))) {
                    terminals.touch(terminal.getId(), now);
                }
            });
        }
        chain.doFilter(request, response);
    }
}
