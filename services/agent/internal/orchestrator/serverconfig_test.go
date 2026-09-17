package orchestrator

import (
	"os"
	"path/filepath"
	"strings"
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

func TestConfigureUpdatesMOTDWhenProvided(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "server.properties")
	if err := os.WriteFile(path, []byte("motd=Old MOTD\nserver-port=25565\n"), 0600); err != nil {
		t.Fatal(err)
	}
	// A real newline in the payload (as a user would type a second line in
	// the UI) must be written as the two-character `\n` escape Minecraft's
	// own properties parser expects — a raw newline byte would instead
	// split this file's own naive line-based format into a second,
	// malformed line.
	payload := protocol.ServerInstallPayload{Port: 25565, Difficulty: "normal", GameMode: "survival", MOTD: "§aWelcome!\n§7Line two"}
	if err := writeServerProperties(dir, payload); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	content := string(data)
	if want := `motd=§aWelcome!\n§7Line two`; !strings.Contains(content, want) {
		t.Errorf("server.properties = %q, want it to contain %q", content, want)
	}
	if strings.Contains(content, "Old MOTD") {
		t.Errorf("server.properties = %q, want the old MOTD replaced", content)
	}
}
