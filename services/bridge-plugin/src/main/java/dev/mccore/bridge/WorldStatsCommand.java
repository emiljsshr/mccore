package dev.mccore.bridge;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.bukkit.Bukkit;
import org.bukkit.World;
import org.bukkit.plugin.Plugin;

/**
 * Answers a single {@code /mccorebridge worldstats <requestId>} console
 * command with one {@code [MCBRIDGE]} line reporting every loaded world's
 * name, loaded chunk count, and entity count — the same request/response
 * round trip {@link InvseeCommand} already implements, just with no target
 * player to look up (a live read taken at the moment the command runs, not
 * a cached one).
 */
final class WorldStatsCommand {
    private WorldStatsCommand() {}

    static void run(Plugin plugin, String requestId) {
        List<Object> worlds = new ArrayList<>();
        for (World world : Bukkit.getWorlds()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("name", world.getName());
            entry.put("loadedChunks", world.getLoadedChunks().length);
            entry.put("entityCount", world.getEntities().size());
            worlds.add(entry);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "worldstats");
        payload.put("requestId", requestId);
        payload.put("worlds", worlds);
        Wire.emit(plugin.getLogger(), payload);
    }
}
