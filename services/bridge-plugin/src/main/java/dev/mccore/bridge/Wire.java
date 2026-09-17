package dev.mccore.bridge;

import java.util.List;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Minimal JSON writer and the one place that emits the marker line the
 * Agent's console scanner looks for. Kept dependency-free on purpose — a
 * JSON library would need shading into the jar, and the actual data shapes
 * here (strings, numbers, booleans, and one level of nested objects/arrays)
 * don't need one.
 */
final class Wire {
    private static final String MARKER = "[MCBRIDGE] ";

    private Wire() {}

    /** Writes one JSON object as a single console line the Agent will pick up. */
    static void emit(Logger logger, Map<String, Object> payload) {
        logger.info(MARKER + toJson(payload));
    }

    @SuppressWarnings("unchecked")
    static String toJson(Object value) {
        if (value == null) return "null";
        if (value instanceof String s) return quote(s);
        if (value instanceof Boolean || value instanceof Number) return String.valueOf(value);
        if (value instanceof Map<?, ?> map) {
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (!first) sb.append(',');
                first = false;
                sb.append(quote(String.valueOf(entry.getKey()))).append(':').append(toJson(entry.getValue()));
            }
            return sb.append('}').toString();
        }
        if (value instanceof List<?> list) {
            StringBuilder sb = new StringBuilder("[");
            boolean first = true;
            for (Object item : list) {
                if (!first) sb.append(',');
                first = false;
                sb.append(toJson(item));
            }
            return sb.append(']').toString();
        }
        // Anything else (a POJO builder didn't intend to pass here) — fail
        // loudly at build time via ClassCastException rather than silently
        // emitting a wrong/lossy value the Agent's parser can't make sense of.
        throw new IllegalArgumentException("Unsupported JSON value type: " + value.getClass());
    }

    private static String quote(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 8).append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
                }
            }
        }
        return sb.append('"').toString();
    }
}
