package tn.damascino.identity.application.command;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.security.Role;
import tn.damascino.common.util.Emails;
import tn.damascino.common.util.PhoneNumbers;
import tn.damascino.common.web.ApiException;
import tn.damascino.identity.application.mail.EmailSender;
import tn.damascino.identity.application.sms.SmsRateLimiter;
import tn.damascino.identity.application.sms.SmsSender;
import tn.damascino.identity.domain.Account;
import tn.damascino.identity.domain.AccountRepository;
import tn.damascino.identity.domain.SmsCode;
import tn.damascino.identity.domain.SmsCodeRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * Activation step 1: the number must be on a partner list (and on the list of the partner whose link was opened);
 * a 6-digit code is then sent by e-mail when the partner list gives an address (free, main channel), otherwise, or
 * when the e-mail cannot be sent, by SMS (backup channel).
 */
@Component
public class RequestSmsCodeHandler implements CommandHandler<RequestSmsCodeCommand, RequestSmsCodeCommand.Sent> {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Logger log = LoggerFactory.getLogger(RequestSmsCodeHandler.class);

    private final AccountRepository accounts;
    private final SmsCodeRepository codes;
    private final SmsSender sender;
    private final EmailSender mail;
    private final SmsRateLimiter rateLimiter;
    private final Clock clock;
    private final Duration ttl;
    private final Duration resendDelay;
    private final int maxPerPhonePerHour;
    private final boolean exposeCodes;

    public RequestSmsCodeHandler(AccountRepository accounts, SmsCodeRepository codes, SmsSender sender,
                                 EmailSender mail, SmsRateLimiter rateLimiter, Clock clock,
                                 @Value("${damascino.sms.code-ttl}") Duration ttl,
                                 @Value("${damascino.sms.resend-delay}") Duration resendDelay,
                                 @Value("${damascino.sms.max-per-phone-per-hour}") int maxPerPhonePerHour,
                                 @Value("${damascino.sms.expose-codes}") boolean exposeCodes) {
        this.accounts = accounts;
        this.codes = codes;
        this.sender = sender;
        this.mail = mail;
        this.rateLimiter = rateLimiter;
        this.clock = clock;
        this.ttl = ttl;
        this.resendDelay = resendDelay;
        this.maxPerPhonePerHour = maxPerPhonePerHour;
        this.exposeCodes = exposeCodes;
    }

    @Override
    @Transactional
    public RequestSmsCodeCommand.Sent handle(RequestSmsCodeCommand command) {
        String phone = PhoneNumbers.normalize(command.phone());
        if (!PhoneNumbers.isValid(phone)) {
            throw ApiException.badRequest("INVALID_PHONE", "Numéro de téléphone invalide : saisissez les 8 chiffres.");
        }
        if (!rateLimiter.tryAcquire(command.clientIp())) {
            throw tooMany("SMS_RATE_LIMITED", "Trop de demandes depuis ce réseau. Réessayez dans une heure.");
        }
        Account account = accounts.findByUsername(phone).filter(a -> a.getRole() == Role.BENEFICIARY)
                .filter(a -> command.partnerId() == null || command.partnerId().equals(a.getPartnerId()))
                .orElseThrow(() -> ApiException.forbidden("NUMBER_NOT_AUTHORIZED", command.partnerId() == null
                        ? "Ce numéro ne figure sur aucune liste de bénéficiaires. Contactez le service RH de votre entreprise."
                        : "Ce numéro ne figure pas sur la liste de votre entreprise. Contactez votre service RH."));
        if (!account.isActive()) {
            throw ApiException.forbidden("ACCOUNT_DISABLED", "Ce compte est désactivé. Contactez Damascino.");
        }

        Instant now = clock.instant();
        codes.findFirstByPhoneOrderByCreatedAtDesc(phone).ifPresent(last -> {
            Duration elapsed = Duration.between(last.getCreatedAt(), now);
            if (elapsed.compareTo(resendDelay) < 0) {
                long wait = resendDelay.minus(elapsed).toSeconds() + 1;
                throw tooMany("SMS_RESEND_TOO_SOON", "Un code vient d'être envoyé. Patientez " + wait
                        + " secondes avant d'en demander un nouveau.");
            }
        });
        if (codes.countByPhoneAndCreatedAtAfter(phone, now.minus(Duration.ofHours(1))) >= maxPerPhonePerHour) {
            throw tooMany("SMS_LIMIT_REACHED", "Nombre maximal de codes atteint pour ce numéro. Réessayez dans une heure.");
        }

        codes.findByPhoneAndConsumedFalse(phone).forEach(SmsCode::invalidate);
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        codes.save(new SmsCode(account.getId(), phone, code, ttl, command.clientIp(), now));
        String email = account.getEmail();
        boolean emailSent = email != null && mail.send(email, "Votre code Damascino Privilèges : " + code,
                emailText(account.getDisplayName(), code));
        if (!emailSent) {
            if (email != null) {
                log.info("E-mail en échec pour {} : code envoyé par SMS", mask(phone));
            }
            try {
                // plain ASCII keeps the message in a single SMS
                sender.send("+216" + phone, "Damascino Privileges : votre code est " + code + ". Valable "
                        + ttl.toMinutes() + " min. Ne le communiquez a personne.");
            } catch (ApiException e) {
                // the e-mail is the main channel: say what is missing rather than a generic failure
                log.warn("Code non envoyé pour {} : {} ; SMS de secours : {}", mask(phone),
                        email == null ? "aucune adresse e-mail sur le compte" : "e-mail en échec", e.getMessage());
                throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "SMS_UNAVAILABLE", email == null
                        ? "Aucune adresse e-mail n'est enregistrée pour ce numéro : demandez à votre service RH de "
                        + "l'ajouter sur la liste des bénéficiaires, puis réessayez."
                        : "L'envoi du code par e-mail a échoué. Réessayez dans quelques minutes ; si le problème "
                        + "persiste, contactez Damascino.");
            }
        }

        // never reveal a code that really left the server
        boolean simulated = emailSent ? mail.simulated() : sender.simulated();
        return new RequestSmsCodeCommand.Sent(mask(phone), ttl.toSeconds(), resendDelay.toSeconds(),
                exposeCodes && simulated ? code : null, !emailSent, emailSent ? Emails.mask(email) : null);
    }

    private String emailText(String name, String code) {
        return "Bonjour " + name + ",\n\n"
                + "Votre code d'activation Damascino Privilèges est : " + code + "\n\n"
                + "Saisissez-le dans l'application. Il est valable " + ttl.toMinutes() + " minutes.\n"
                + "Ne le communiquez à personne : Damascino ne vous le demandera jamais.\n\n"
                + "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n\n"
                + "Damascino — oriental kitchen and coffee";
    }

    static String mask(String phone) {
        return "+216 •• ••• " + phone.substring(5);
    }

    private static ApiException tooMany(String code, String message) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, code, message);
    }
}
