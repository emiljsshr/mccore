package dev.mccore.bridge;

import java.time.Duration;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.title.Title;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

/**
 * Server-side-only "launcher-like" toast for achievement/death moments — a
 * styled {@link Title} (big text + subtitle, with fade-in/stay/fade-out
 * timing) plus a short-lived {@link BossBar}, both vanilla-compatible
 * Paper/Adventure APIs shown only to the player the moment happened to. No
 * client mod, no resource pack, and — deliberately, as a first pass — no
 * configuration: colors and timings are fixed per event type rather than a
 * themeable notification system.
 */
final class Notify {
    private static final Title.Times TIMES =
            Title.Times.times(Duration.ofMillis(300), Duration.ofMillis(3000), Duration.ofMillis(500));
    // Slightly longer than TIMES' total (~3.8s) so the boss bar never
    // disappears mid-fade-out.
    private static final long BOSS_BAR_TICKS = 80L; // 4s

    private Notify() {}

    static void achievement(Plugin plugin, Player player, String title, String description) {
        show(
                plugin,
                player,
                Component.text(title, NamedTextColor.GOLD, TextDecoration.BOLD),
                Component.text(description, NamedTextColor.YELLOW),
                BossBar.Color.YELLOW);
    }

    static void death(Plugin plugin, Player player, String message) {
        show(
                plugin,
                player,
                Component.text("You Died", NamedTextColor.DARK_RED, TextDecoration.BOLD),
                Component.text(message, NamedTextColor.GRAY),
                BossBar.Color.RED);
    }

    private static void show(Plugin plugin, Player player, Component title, Component subtitle, BossBar.Color color) {
        player.showTitle(Title.title(title, subtitle, TIMES));

        BossBar bar = BossBar.bossBar(subtitle, 1f, color, BossBar.Overlay.PROGRESS);
        player.showBossBar(bar);
        Bukkit.getScheduler().runTaskLater(plugin, () -> player.hideBossBar(bar), BOSS_BAR_TICKS);
    }
}
