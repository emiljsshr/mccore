// Package bridge parses the [MCBRIDGE] {...json...} console lines the
// mcCore Bridge plugin (services/bridge-plugin) writes — the only channel
// it has back to this Agent, since it deliberately opens no network port of
// its own. See that plugin's Wire.java for the line format this mirrors.
package bridge

import (
	"encoding/json"
	"regexp"
)

// markerRe matches the JSON object even though Bukkit's logger prepends
// its own "[HH:MM:SS INFO]: [mcCoreBridge] " prefix first — this only
// anchors on the marker itself, not the line's start.
var markerRe = regexp.MustCompile(`\[MCBRIDGE\] (\{.*\})\s*$`)

// Parse extracts and decodes the JSON payload from one console line, or
// returns ok=false for the overwhelming majority of lines that aren't a
// Bridge line at all.
func Parse(line string) (data map[string]any, ok bool) {
	m := markerRe.FindStringSubmatch(line)
	if m == nil {
		return nil, false
	}
	if err := json.Unmarshal([]byte(m[1]), &data); err != nil {
		return nil, false
	}
	return data, true
}

func str(data map[string]any, key string) string {
	v, _ := data[key].(string)
	return v
}

// String reads a required-in-practice string field, defaulting to "" if
// absent or the wrong type rather than panicking — a malformed line from a
// future plugin version should degrade, not crash the Agent.
func String(data map[string]any, key string) string { return str(data, key) }
