package tn.damascino.partner.application.importing;

import tn.damascino.partner.application.IssuedCredentials;

import java.util.List;

public record ImportReport(int totalRows, List<IssuedCredentials> created, List<Skipped> skipped) {

    public record Skipped(int line, String lastName, String firstName, String phone, String reason) {
    }
}
