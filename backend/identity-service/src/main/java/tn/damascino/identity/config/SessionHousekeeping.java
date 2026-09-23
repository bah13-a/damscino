package tn.damascino.identity.config;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.identity.domain.RefreshSessionRepository;

import java.time.Clock;

@Component
public class SessionHousekeeping {

    private final RefreshSessionRepository sessions;
    private final Clock clock;

    public SessionHousekeeping(RefreshSessionRepository sessions, Clock clock) {
        this.sessions = sessions;
        this.clock = clock;
    }

    @Scheduled(cron = "0 0 4 * * *", zone = "Africa/Tunis")
    @Transactional
    public void purgeExpiredSessions() {
        sessions.purgeExpired(clock.instant());
    }
}
