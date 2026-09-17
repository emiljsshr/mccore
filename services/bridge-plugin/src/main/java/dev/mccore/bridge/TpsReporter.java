package dev.mccore.bridge;

import java.util.LinkedHashMap;
import java.util.Map;
import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitRunnable;

/**
 * Reports real server performance every 10s: the 1-minute TPS average and
 * the average tick time (MSPT), straight from Paper's own scheduler —
 * {@code Bukkit.getTPS()[0]} and {@code Bukkit.getAverageTickTime()} — not
 * a fragile console-log heuristic. Started once in {@code onEnable} via
 * {@code runTaskTimer}; Bukkit cancels it automatically on plugin disable.
 */
final class TpsReporter extends BukkitRunnable {
    // 10s at 20 ticks/s — matches the Agent's own host-metrics sample rate.
    static final long PERIOD_TICKS = 200L;

    private final Plugin plugin;

    TpsReporter(Plugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public void run() {
        double[] tps = Bukkit.getTPS();
        // Paper's TPS can briefly read above 20 right after startup; clamp
        // to the real ceiling rather than forward a misleading spike.
        double tps1m = tps.length > 0 ? Math.min(tps[0], 20.0) : 20.0;
        double mspt = Bukkit.getAverageTickTime();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "tps");
        payload.put("tps1m", tps1m);
        payload.put("mspt", mspt);
        Wire.emit(plugin.getLogger(), payload);
    }
}
