package tn.damascino.privilege.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import tn.damascino.common.security.JwtService;
import tn.damascino.common.security.SecuritySupport;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService) throws Exception {
        return SecuritySupport.statelessJwt(http, jwtService)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers("/api/privileges/me", "/api/privileges/qr").hasRole("BENEFICIARY")
                        .requestMatchers("/api/privileges/scan/**").hasAnyRole("STAFF", "ADMIN")
                        .anyRequest().denyAll())
                .build();
    }
}
