package tn.damascino.privilege.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import tn.damascino.common.security.JwtService;
import tn.damascino.common.security.SecuritySupport;
import tn.damascino.privilege.pos.PosApiKeyFilter;
import tn.damascino.privilege.pos.PosTerminalRepository;

import java.time.Clock;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService, PosTerminalRepository terminals,
                                                   Clock clock) throws Exception {
        return SecuritySupport.statelessJwt(http, jwtService)
                .addFilterBefore(new PosApiKeyFilter(terminals, clock), UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers("/api/privileges/me", "/api/privileges/qr").hasRole("BENEFICIARY")
                        .requestMatchers("/api/privileges/scan/**").hasAnyRole("STAFF", "ADMIN")
                        .requestMatchers("/api/pos/v1/**").hasRole("POS")
                        .requestMatchers("/api/pos-terminals/**", "/api/pos-products/**").hasRole("ADMIN")
                        .anyRequest().denyAll())
                .build();
    }
}
