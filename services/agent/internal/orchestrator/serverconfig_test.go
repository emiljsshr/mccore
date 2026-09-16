package orchestrator

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/cometa-mccore/mccore/services/agent/internal/protocol"
)

func TestConfigurePreservesWorldAndCustomProperties(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "server.properties")
	if err := os.WriteFile(path, []byte("level-name=survival\nmotd=My server\nview-distance=16\nserver-port=25565\n"), 0600); err != nil {
		t.Fatal(err)
	}
	payload := protocol.ServerInstallPayload{Port: 25566, MaxPlayers: 40, Difficulty: "hard", GameMode: "survival", OnlineMode: true}
	if err := writeServerProperties(dir, payload); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	props := parseProperties(string(data))
	for key, want := range map[string]string{"level-name": "survival", "motd": "My server", "view-distance": "16", "server-port": "25566", "max-players": "40"} {
		if props[key] != want {
			t.Errorf("%s = %q, want %q", key, props[key], want)
		}
	}
}
