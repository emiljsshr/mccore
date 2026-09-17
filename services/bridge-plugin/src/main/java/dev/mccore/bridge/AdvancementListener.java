package dev.mccore.bridge;

import java.util.LinkedHashMap;
import java.util.Map;
import io.papermc.paper.advancement.AdvancementDisplay;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.advancement.Advancement;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerAdvancementDoneEvent;
import org.bukkit.plugin.Plugin;

/**
 * Reports advancements the same way the server would announce them to chat
 * ({@code doesAnnounceToChat()}), so this only ever reports what a real
 * player watching the server would actually see — never the internal
 * "root"/recipe-unlock advancements Minecraft itself keeps hidden.
 */
final class AdvancementListener implements Listener {
    private final Plugin plugin;

    AdvancementListener(Plugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler
    public void onAdvancement(PlayerAdvancementDoneEvent event) {
        Advancement advancement = event.getAdvancement();
        AdvancementDisplay display = advancement.getDisplay();
        if (display == null || !display.doesAnnounceToChat()) return;

        Player player = event.getPlayer();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "achievement");
        payload.put("uuid", player.getUniqueId().toString());
        payload.put("player", player.getName());
        payload.put("key", advancement.getKey().toString());
        payload.put("title", PlainTextComponentSerializer.plainText().serialize(display.title()));
        payload.put("description", PlainTextComponentSerializer.plainText().serialize(display.description()));
        Wire.emit(plugin.getLogger(), payload);
    }
}
