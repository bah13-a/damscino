package tn.damascino.privilege.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import tn.damascino.common.cqrs.CommandBus;
import tn.damascino.privilege.pos.PosPrincipal;
import tn.damascino.privilege.pos.PosValidateQrCommand;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Handheld scanners validating the QR code in one call (docs/INTEGRATION_CAISSE.md): the till software itself, or a
 * network scanner (Wi-Fi / Ethernet) that sends what it reads to its address.
 */
@RestController
@RequestMapping("/api/pos/v1")
public class TillQrController {

    /** Signed code of the beneficiary app, wherever the scanner puts it (JSON field, form field, raw text, query). */
    private static final Pattern QR_CODE = Pattern.compile("DP1\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]{43}");
    private static final int MAX_BODY = 16 * 1024;

    private final CommandBus commands;

    public TillQrController(CommandBus commands) {
        this.commands = commands;
    }

    public record ValidateQrRequest(@NotBlank String qrCode, String cashier, String ticketId) {
    }

    /** Validates the scanned code and records the passage; the till applies its discount when {@code valid}. */
    @PostMapping("/validate-qr")
    public PosValidateQrCommand.Result validateQr(@Valid @RequestBody ValidateQrRequest request) {
        return commands.dispatch(new PosValidateQrCommand(terminal(), request.qrCode(), request.cashier(),
                request.ticketId()));
    }

    /**
     * Address entered in a network scanner. The request format differs between manufacturers, so the QR code is looked
     * for in the whole request; anything else (heartbeat, configuration code, product barcode) is answered without
     * being recorded.
     */
    @RequestMapping(path = "/douchette/{key}", method = {RequestMethod.GET, RequestMethod.POST})
    public PosValidateQrCommand.Result networkScanner(HttpServletRequest request) throws IOException {
        String body = new String(request.getInputStream().readNBytes(MAX_BODY), StandardCharsets.UTF_8);
        StringBuilder text = new StringBuilder(decode(request.getQueryString())).append('\n').append(decode(body));
        request.getParameterMap().values().forEach(values -> text.append('\n').append(String.join("\n", values)));
        Matcher code = QR_CODE.matcher(text);
        if (!code.find()) {
            return new PosValidateQrCommand.Result(false, "NO_QR_CODE", "Aucun QR code Damascino Privilèges lu", null,
                    null, null, null, null, null);
        }
        return commands.dispatch(new PosValidateQrCommand(terminal(), code.group(), null, null));
    }

    private static String decode(String value) {
        if (value == null) {
            return "";
        }
        try {
            return URLDecoder.decode(value, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return value;
        }
    }

    private static PosPrincipal terminal() {
        return (PosPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
