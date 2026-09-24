package tn.damascino.reporting.reconciliation;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;

/** Tolerant parsing of the amounts and dates found in till exports. */
public final class Values {

    private static final List<DateTimeFormatter> DATE_TIMES = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm[:ss]"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm[:ss]"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm[:ss]"),
            DateTimeFormatter.ofPattern("d/M/yyyy H:mm[:ss]"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm[:ss]"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm[:ss]"),
            DateTimeFormatter.ofPattern("dd/MM/yy HH:mm[:ss]"));
    private static final List<DateTimeFormatter> DATES = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("d/M/yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy"),
            DateTimeFormatter.ofPattern("dd/MM/yy"));
    private static final List<DateTimeFormatter> TIMES = List.of(
            DateTimeFormatter.ofPattern("H:mm[:ss]"),
            DateTimeFormatter.ofPattern("H'h'mm"));

    private Values() {
    }

    /** "8,000" "8.000 DT" "-8,000" "1.234,500" → positive amount in dinars; null when not a number. */
    public static BigDecimal amount(String raw) {
        if (raw == null) {
            return null;
        }
        String s = raw.replaceAll("(?i)dt|tnd|د\\.ت|\\s| ", "").replace("−", "-");
        if (s.isEmpty()) {
            return null;
        }
        int comma = s.lastIndexOf(',');
        int dot = s.lastIndexOf('.');
        if (comma >= 0 && dot >= 0) {
            // the last separator is the decimal one, the other groups thousands
            s = comma > dot ? s.replace(".", "").replace(',', '.') : s.replace(",", "");
        } else if (comma >= 0) {
            s = s.replace(',', '.');
        }
        try {
            return new BigDecimal(s).abs();
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static LocalDateTime dateTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.trim().replaceAll("\\s+", " ");
        for (DateTimeFormatter f : DATE_TIMES) {
            try {
                return LocalDateTime.parse(s, f);
            } catch (DateTimeParseException ignored) {
                // next format
            }
        }
        LocalDate date = date(s);
        return date == null ? null : date.atStartOfDay();
    }

    public static LocalDateTime dateTime(String date, String time) {
        LocalDate d = date(date);
        if (d == null) {
            return dateTime(date);
        }
        LocalTime t = time(time);
        return t == null ? d.atStartOfDay() : d.atTime(t);
    }

    static LocalDate date(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.trim().split(" ")[0];
        for (DateTimeFormatter f : DATES) {
            try {
                return LocalDate.parse(s, f);
            } catch (DateTimeParseException ignored) {
                // next format
            }
        }
        return null;
    }

    static LocalTime time(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.trim();
        if (s.contains(" ")) {
            s = s.substring(s.lastIndexOf(' ') + 1);
        }
        for (DateTimeFormatter f : TIMES) {
            try {
                return LocalTime.parse(s, f);
            } catch (DateTimeParseException ignored) {
                // next format
            }
        }
        return null;
    }

    /** Lower case, no accents, single spaces: used to compare labels and headers. */
    public static String simplify(String value) {
        String s = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }
}
