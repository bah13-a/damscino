package tn.damascino.reporting.reconciliation;

import java.util.List;

/**
 * Which columns of the till export hold each piece of information (0-based indexes, null = absent). Either
 * {@code dateTime}, or {@code date} (+ optional {@code time}).
 */
public record ColumnMapping(Integer dateTime, Integer date, Integer time, Integer ticket, Integer amount, Integer label,
                            Integer code, Integer cashier) {

    /** Best guess from the header names (the administrator can correct it before running the comparison). */
    public static ColumnMapping guess(List<String> headers) {
        Integer dateTime = null, date = null, time = null, ticket = null, amount = null, label = null, code = null, cashier = null;
        for (int i = 0; i < headers.size(); i++) {
            String h = Values.simplify(headers.get(i));
            boolean discountWord = h.matches(".*\\b(remise|reduction|discount|solde|rabais)\\b.*");
            if (h.matches(".*\\bdate\\b.*") && h.matches(".*\\b(heure|time)\\b.*") && dateTime == null) {
                dateTime = i;
            } else if (h.matches(".*\\b(date|jour)\\b.*") && date == null) {
                date = i;
            } else if (h.matches(".*\\b(heure|time)\\b.*") && time == null) {
                time = i;
            } else if (h.matches(".*\\b(ticket|facture|recu|commande|transaction)\\b.*") && ticket == null) {
                ticket = i;
            } else if (discountWord && h.matches(".*\\b(libelle|motif|type|nom|raison)\\b.*") && label == null) {
                label = i;
            } else if (discountWord && amount == null) {
                amount = i;
            } else if (h.matches(".*\\b(commentaire|code|reference|ref|note|observation)\\b.*") && code == null) {
                code = i;
            } else if (h.matches(".*\\b(caissier|vendeur|serveur|utilisateur|operateur|employe)\\b.*") && cashier == null) {
                cashier = i;
            }
        }
        if (dateTime == null && date != null && time == null) {
            dateTime = date;
            date = null;
        }
        return new ColumnMapping(dateTime, date, time, ticket, amount, label, code, cashier);
    }
}
