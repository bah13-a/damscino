package tn.damascino.common.time;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class UsagePeriodTest {

    private final LocalDate wednesday = LocalDate.of(2026, 9, 23);

    @Test
    void keysIdentifyTheCalendarPeriod() {
        assertThat(UsagePeriod.DAY.keyOf(wednesday)).isEqualTo("2026-09-23");
        assertThat(UsagePeriod.WEEK.keyOf(wednesday)).isEqualTo("2026-W39");
        assertThat(UsagePeriod.MONTH.keyOf(wednesday)).isEqualTo("2026-09");
    }

    @Test
    void nextStartIsTheFirstDayOfTheFollowingPeriod() {
        assertThat(UsagePeriod.DAY.nextStart(wednesday)).isEqualTo(LocalDate.of(2026, 9, 24));
        assertThat(UsagePeriod.WEEK.nextStart(wednesday)).isEqualTo(LocalDate.of(2026, 9, 28));
        assertThat(UsagePeriod.MONTH.nextStart(wednesday)).isEqualTo(LocalDate.of(2026, 10, 1));
    }
}
