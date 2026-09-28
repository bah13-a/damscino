package tn.damascino.identity.application.command;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.common.events.AccountActivated;
import tn.damascino.common.events.BeneficiarySessionChanged;
import tn.damascino.common.outbox.EventPublisher;
import tn.damascino.common.security.Secrets;
import tn.damascino.common.util.PhoneNumbers;
import tn.damascino.common.web.ApiException;
import tn.damascino.identity.application.AuthResult;
import tn.damascino.identity.application.TokenIssuer;
import tn.damascino.identity.domain.Account;
import tn.damascino.identity.domain.AccountRepository;
import tn.damascino.identity.domain.RefreshSessionRepository;
import tn.damascino.identity.domain.SmsCode;
import tn.damascino.identity.domain.SmsCodeRepository;

import java.time.Clock;
import java.time.Instant;

/**
 * Activation step 2: a valid code activates the account and opens a long session on this phone. Any session on
 * another phone ends, so a new code is only needed when the beneficiary changes phone.
 */
@Component
public class VerifySmsCodeHandler implements CommandHandler<VerifySmsCodeCommand, AuthResult> {

    private final SmsCodeRepository codes;
    private final AccountRepository accounts;
    private final RefreshSessionRepository sessions;
    private final PasswordEncoder passwordEncoder;
    private final TokenIssuer tokenIssuer;
    private final EventPublisher events;
    private final Clock clock;
    private final int maxAttempts;

    public VerifySmsCodeHandler(SmsCodeRepository codes, AccountRepository accounts, RefreshSessionRepository sessions,
                                PasswordEncoder passwordEncoder, TokenIssuer tokenIssuer, EventPublisher events,
                                Clock clock, @Value("${damascino.sms.max-attempts}") int maxAttempts) {
        this.codes = codes;
        this.accounts = accounts;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.tokenIssuer = tokenIssuer;
        this.events = events;
        this.clock = clock;
        this.maxAttempts = maxAttempts;
    }

    @Override
    @Transactional(noRollbackFor = ApiException.class)
    public AuthResult handle(VerifySmsCodeCommand command) {
        Instant now = clock.instant();
        String phone = PhoneNumbers.normalize(command.phone());
        SmsCode code = PhoneNumbers.isValid(phone) ? codes.findFirstByPhoneOrderByCreatedAtDesc(phone).orElse(null) : null;
        if (code == null) {
            throw expired();
        }
        switch (code.verify(command.code(), now, maxAttempts)) {
            case EXPIRED -> throw expired();
            case TOO_MANY_ATTEMPTS -> throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "SMS_CODE_BLOCKED",
                    "Trop d'essais incorrects : demandez un nouveau code.");
            case WRONG -> {
                int left = code.remainingAttempts(maxAttempts);
                throw ApiException.unauthorized("INVALID_SMS_CODE",
                        "Code incorrect. Il reste " + left + (left > 1 ? " essais." : " essai."));
            }
            case VALID -> {
                // continue below
            }
        }

        Account account = accounts.findById(code.getAccountId()).orElseThrow(VerifySmsCodeHandler::expired);
        if (!account.isActive()) {
            throw ApiException.forbidden("ACCOUNT_DISABLED", "Ce compte est désactivé. Contactez Damascino.");
        }
        boolean firstActivation = account.signInBySms(passwordEncoder.encode(Secrets.randomToken(32)), now);
        sessions.deleteAllForAccount(account.getId());
        events.publish(new BeneficiarySessionChanged(account.getBeneficiaryId(), account.getSessionVersion()));
        if (firstActivation) {
            events.publish(new AccountActivated(account.getId(), account.getBeneficiaryId(), now));
        }
        return tokenIssuer.open(account, command.userAgent());
    }

    private static ApiException expired() {
        return ApiException.badRequest("SMS_CODE_EXPIRED", "Code expiré ou déjà utilisé : demandez un nouveau code.");
    }
}
