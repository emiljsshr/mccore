package dev.mccore.bridge;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.PlayerInventory;
import org.bukkit.plugin.Plugin;

/**
 * Answers a single {@code /mccorebridge invsee <requestId> <username>}
 * console command with one {@code [MCBRIDGE]} inventory-snapshot line — a
 * live read taken at the moment the command runs, not a cached/periodic
 * one, since inventories change too fast for a snapshot to still be
 * accurate a few seconds later.
 */
final class InvseeCommand {
    private InvseeCommand() {}

    static void run(Plugin plugin, String requestId, String username) {
        Player player = Bukkit.getPlayerExact(username);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "inventory");
        payload.put("requestId", requestId);
        payload.put("player", username);

        if (player == null) {
            payload.put("error", "Player is not online.");
            Wire.emit(plugin.getLogger(), payload);
            return;
        }

        PlayerInventory inv = player.getInventory();
        payload.put("uuid", player.getUniqueId().toString());
        payload.put("helmet", itemOrNull(inv.getHelmet()));
        payload.put("chestplate", itemOrNull(inv.getChestplate()));
        payload.put("leggings", itemOrNull(inv.getLeggings()));
        payload.put("boots", itemOrNull(inv.getBoots()));
        payload.put("offhand", itemOrNull(inv.getItemInOffHand()));
        payload.put("hotbar", slots(inv, 0, 9));
        payload.put("main", slots(inv, 9, 36));
        Wire.emit(plugin.getLogger(), payload);
    }

    private static java.util.List<Object> slots(PlayerInventory inv, int from, int to) {
        java.util.List<Object> out = new java.util.ArrayList<>(to - from);
        for (int i = from; i < to; i++) {
            out.add(itemOrNull(inv.getItem(i)));
        }
        return out;
    }

    private static Object itemOrNull(ItemStack stack) {
        if (stack == null || stack.getType().isAir()) return null;
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("itemId", stack.getType().getKey().toString());
        item.put("name", displayName(stack));
        item.put("count", stack.getAmount());
        item.put("enchanted", !stack.getEnchantments().isEmpty());
        return item;
    }

    private static String displayName(ItemStack stack) {
        if (stack.hasItemMeta() && stack.getItemMeta().hasDisplayName()) {
            return PlainTextComponentSerializer.plainText().serialize(stack.getItemMeta().displayName());
        }
        String[] words = stack.getType().name().toLowerCase(Locale.ROOT).split("_");
        StringBuilder sb = new StringBuilder();
        for (String word : words) {
            if (!sb.isEmpty()) sb.append(' ');
            sb.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return sb.toString();
    }
}
