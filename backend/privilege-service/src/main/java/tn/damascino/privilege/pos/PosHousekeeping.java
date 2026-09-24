package tn.damascino.privilege.pos;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;

/** Marks abandoned reservations as expired (they already stopped counting once their time was up). */
@Component
public class PosHousekeeping {

    private final PosReservationRepository reservations;
    private final Clock clock;

    public PosHousekeeping(PosReservationRepository reservations, Clock clock) {
        this.reservations = reservations;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "PT1M")
    @Transactional
    public void expireReservations() {
        reservations.expire(clock.instant());
    }
}
