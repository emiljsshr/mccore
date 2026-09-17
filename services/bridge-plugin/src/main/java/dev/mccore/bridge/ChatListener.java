package dev.mccore.bridge;

import io.papermc.paper.event.player.AsyncChatEvent;
import java.util.LinkedHashMap;
import java.util.Map;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.plugin.Plugin;

/**
 * Fire-and-forget chat bridge: reports every player chat message so the
 * dashboard's live chat panel can mirror it (see
 * {@code /mccorebridge broadcast} for the other direction). Uses Paper's
 * {@link AsyncChatEvent} rather than the deprecated
 * {@code org.bukkit.event.player.AsyncPlayerChatEvent} — this never touches
 * {@code event.message()}/renderer, so it doesn't affect what's actually
 * shown in-game.
 */
final class ChatListener implements Listener {
    private final Plugin plugin;

    ChatListener(Plugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler
    public void onChat(AsyncChatEvent event) {
        Player player = event.getPlayer();
        String message = PlainTextComponentSerializer.plainText().serialize(event.message());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "chat");
        payload.put("uuid", player.getUniqueId().toString());
        payload.put("username", player.getName());
        payload.put("message", message);
        Wire.emit(plugin.getLogger(), payload);
    }
}
