package tn.damascino.partner.application.importing;

/** One line of the imported file (line number as displayed in Excel, header = line 1). */
public record ImportRow(int line, String lastName, String firstName, String phone) {
}
