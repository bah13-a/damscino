package tn.damascino.common.cqrs;

public interface CommandHandler<C extends Command<R>, R> {
    R handle(C command);
}
