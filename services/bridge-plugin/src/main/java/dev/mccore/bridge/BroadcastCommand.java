package dev.mccore.bridge;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;

/**
 * Answers {@code /mccorebridge broadcast <message...>} by sending the
 * message server-wide — the other direction of the chat bridge (see
 * {@link ChatListener}). Native {@code Bukkit.broadcast}, no client mod:
 * every online player sees it in their normal chat.
 */
final class BroadcastCommand {
    private BroadcastCommand() {}

    static void run(String message) {
        Bukkit.broadcast(Component.text("[Server] ", NamedTextColor.GOLD).append(Component.text(message, NamedTextColor.WHITE)));
    }
}
