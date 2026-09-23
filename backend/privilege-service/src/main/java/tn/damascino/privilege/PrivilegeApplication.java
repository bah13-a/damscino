package tn.damascino.privilege;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = "tn.damascino", exclude = UserDetailsServiceAutoConfiguration.class)
@EntityScan(basePackages = "tn.damascino")
@EnableJpaRepositories(basePackages = "tn.damascino")
public class PrivilegeApplication {

    public static void main(String[] args) {
        SpringApplication.run(PrivilegeApplication.class, args);
    }
}
