package tn.damascino.privilege.pos;

import java.util.UUID;

/** Authenticated till (from its API key). */
public record PosPrincipal(UUID terminalId, String name) {
}
