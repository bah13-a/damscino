package tn.damascino.common.time;

import java.time.ZoneId;

public final class Zones {

    /** Business time zone: daily quotas reset at midnight, Tunis time. */
    public static final ZoneId TUNIS = ZoneId.of("Africa/Tunis");

    private Zones() {
    }
}
