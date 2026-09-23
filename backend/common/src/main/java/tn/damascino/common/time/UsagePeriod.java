package tn.damascino.common.time;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;

/** Period over which the usage quota of a partner is counted. */
public enum UsagePeriod {
    DAY,
    WEEK,
    MONTH;

    /** Stable key identifying the period that contains {@code date}, e.g. 2026-09-23, 2026-W39, 2026-09. */
    public String keyOf(LocalDate date) {
        return switch (this) {
            case DAY -> date.toString();
            case WEEK -> "%d-W%02d".formatted(date.get(IsoFields.WEEK_BASED_YEAR), date.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
            case MONTH -> "%d-%02d".formatted(date.getYear(), date.getMonthValue());
        };
    }

    /** First day of the period following the one that contains {@code date}. */
    public LocalDate nextStart(LocalDate date) {
        return switch (this) {
            case DAY -> date.plusDays(1);
            case WEEK -> date.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
            case MONTH -> date.with(TemporalAdjusters.firstDayOfNextMonth());
        };
    }
}
