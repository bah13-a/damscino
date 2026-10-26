package tn.damascino.identity.api;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tn.damascino.common.security.SecuritySupport;
import tn.damascino.identity.application.mail.MailSettingsService;

import java.util.Map;

/** Administration → Messagerie (administrators only, see SecurityConfig). */
@RestController
@RequestMapping("/api/mail-settings")
public class MailSettingsController {

    private final MailSettingsService service;

    public MailSettingsController(MailSettingsService service) {
        this.service = service;
    }

    public record TestRequest(String to, String host, Integer port, String username, String password,
                              String fromAddress) {
    }

    @GetMapping
    public MailSettingsService.View get() {
        return service.view();
    }

    @PutMapping
    public MailSettingsService.View save(@RequestBody MailSettingsService.Form form) {
        return service.save(SecuritySupport.currentUser(), form);
    }

    @PostMapping("/test")
    public Map<String, Boolean> test(@RequestBody TestRequest request) {
        service.test(new MailSettingsService.Form(request.host(), request.port(), request.username(), request.password(),
                request.fromAddress()), request.to());
        return Map.of("sent", true);
    }

    @DeleteMapping
    public MailSettingsService.View reset() {
        return service.reset(SecuritySupport.currentUser());
    }
}
