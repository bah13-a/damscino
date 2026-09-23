package tn.damascino.common.cqrs;

/**
 * Marker for a command: an intention to change the state of the system.
 *
 * @param <R> type of the result returned once the command is handled
 */
public interface Command<R> {
}
