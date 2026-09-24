package tn.damascino.privilege.pos;

import tn.damascino.common.cqrs.Command;

/** The till scanned the QR code of a client on an open ticket: which line gets the advantage? */
public record PosPreviewCommand(PosPrincipal terminal, PosDtos.PreviewRequest request)
        implements Command<PosDtos.PreviewResponse> {
}
