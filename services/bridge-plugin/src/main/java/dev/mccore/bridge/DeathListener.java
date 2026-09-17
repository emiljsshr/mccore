package dev.mccore.bridge;

import java.util.LinkedHashMap;
import java.util.Map;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.plugin.Plugin;

/**
 * Reports player deaths for the dashboard's kill-feed. {@code message} is
 * the server's own death message — already killer-attributed by vanilla
 * Minecraft itself whenever {@link PlayerDeathEvent#getEntity()}'s killer is
 * a player (e.g. "Steve was slain by Alex"), so this never has to build
 * that attribution itself; {@code killer} is included in addition, for
 * callers that want the attacker's identity without parsing the message.
 */
final class DeathListener implements Listener {
    private final Plugin plugin;

    DeathListener(Plugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler
    public void onDeath(PlayerDeathEvent event) {
        Player victim = event.getEntity();
        Component deathMessage = event.deathMessage();
        // Defensive: a deathMessage() of null (e.g. another plugin cleared
        // it in an earlier-priority listener) shouldn't drop the event.
        String message = deathMessage != null
                ? PlainTextComponentSerializer.plainText().serialize(deathMessage)
                : victim.getName() + " died";

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "death");
        payload.put("uuid", victim.getUniqueId().toString());
        payload.put("username", victim.getName());
        payload.put("message", message);
        Player killer = victim.getKiller();
        if (killer != null) {
            payload.put("killer", killer.getName());
        }
        Wire.emit(plugin.getLogger(), payload);

        Notify.death(plugin, victim, message);
    }
}
