package tn.damascino.identity.config;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.identity.domain.RefreshSessionRepository;
import tn.damascino.identity.domain.SmsCodeRepository;

import java.time.Clock;
import java.time.Duration;

@Component
public class SessionHousekeeping {

    private final RefreshSessionRepository sessions;
    private final SmsCodeRepository smsCodes;
    private final Clock clock;

    public SessionHousekeeping(RefreshSessionRepository sessions, SmsCodeRepository smsCodes, Clock clock) {
        this.sessions = sessions;
        this.smsCodes = smsCodes;
        this.clock = clock;
    }

    @Scheduled(cron = "0 0 4 * * *", zone = "Africa/Tunis")
    @Transactional
    public void purgeExpiredSessions() {
        sessions.purgeExpired(clock.instant());
        // SMS codes are only kept as a trace of the sending volume
        smsCodes.purgeOlderThan(clock.instant().minus(Duration.ofDays(30)));
    }
}
