package tn.damascino.common.security;

public enum Role {
    /** Administrateur Damascino (back-office). */
    ADMIN,
    /** Serveur / caissier utilisant le scanner. */
    STAFF,
    /** Collaborateur d'un partenaire bénéficiant de l'avantage. */
    BENEFICIARY
}
