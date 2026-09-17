package dev.mccore.bridge;

import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Reports live in-game data back to the mcCore Agent over this server's own
 * console output (the {@code [MCBRIDGE] {...json...}} lines {@link Wire}
 * writes) — deliberately not a network listener of its own, so it needs no
 * port, no auth of its own, and nothing for an operator to firewall. Inbound
 * requests arrive the same way every other mcCore console command already
 * does: as a console command this plugin registers ({@code /mccorebridge}).
 *
 * Installed and updated automatically by the Agent (see
 * services/agent/internal/orchestrator/bridgeplugin.go); not meant to be
 * dropped into a plugins/ folder by hand.
 */
public final class McCoreBridgePlugin extends JavaPlugin {
    @Override
    public void onEnable() {
        getServer().getPluginManager().registerEvents(new AdvancementListener(this), this);
        getLogger().info("mcCoreBridge ready.");
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!command.getName().equalsIgnoreCase("mccorebridge")) return false;
        if (args.length < 1) {
            sender.sendMessage("Usage: /mccorebridge <invsee> <requestId> <username>");
            return true;
        }
        switch (args[0].toLowerCase(java.util.Locale.ROOT)) {
            case "invsee" -> {
                if (args.length < 3) {
                    sender.sendMessage("Usage: /mccorebridge invsee <requestId> <username>");
                    return true;
                }
                InvseeCommand.run(this, args[1], args[2]);
            }
            default -> sender.sendMessage("Unknown mcCoreBridge subcommand: " + args[0]);
        }
        return true;
    }
}
