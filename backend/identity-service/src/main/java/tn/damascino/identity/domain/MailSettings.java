package tn.damascino.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** E-mail account used to send the activation codes, entered in the administration (single row, id 1). */
@Entity
@Table(name = "mail_settings")
public class MailSettings {

    public static final short SINGLETON = 1;

    @Id
    private short id = SINGLETON;

    @Column(nullable = false)
    private String host;

    private int port;

    @Column(nullable = false)
    private String username;

    @Column(name = "password_cipher", nullable = false)
    private String passwordCipher;

    @Column(name = "from_address", nullable = false)
    private String fromAddress;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by", nullable = false)
    private String updatedBy;

    protected MailSettings() {
    }

    public MailSettings(String host, int port, String username, String passwordCipher, String fromAddress,
                        String updatedBy, Instant now) {
        update(host, port, username, passwordCipher, fromAddress, updatedBy, now);
    }

    public void update(String host, int port, String username, String passwordCipher, String fromAddress,
                       String updatedBy, Instant now) {
        this.host = host;
        this.port = port;
        this.username = username;
        this.passwordCipher = passwordCipher;
        this.fromAddress = fromAddress;
        this.updatedBy = updatedBy;
        this.updatedAt = now;
    }

    public String getHost() {
        return host;
    }

    public int getPort() {
        return port;
    }

    public String getUsername() {
        return username;
    }

    public String getPasswordCipher() {
        return passwordCipher;
    }

    public String getFromAddress() {
        return fromAddress;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }
}
