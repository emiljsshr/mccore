package main

import (
	"bufio"
	"flag"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

func cmdAgent(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: mccore agent status | mccore agent enroll --token <token>")
	}
	switch args[0] {
	case "status":
		return cmdAgentStatus()
	case "enroll":
		return cmdAgentEnroll(args[1:])
	default:
		return fmt.Errorf("unknown agent subcommand %q", args[0])
	}
}

func cmdAgentStatus() error {
	cfg, err := loadCLIConfig()
	if err != nil {
		return err
	}
	active, _ := isActive(unitNames["agent"])
	fmt.Printf("service: %s\n", boolLabel(active, "active", "inactive"))

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://" + cfg.HealthListenAddr + "/healthz")
	if err != nil {
		fmt.Printf("health:  unreachable (%v)\n", err)
		return nil
	}
	defer resp.Body.Close()
	fmt.Printf("health:  HTTP %d\n", resp.StatusCode)
	return nil
}

func boolLabel(b bool, t, f string) string {
	if b {
		return t
	}
	return f
}

// cmdAgentEnroll writes an enrollment token into the local config file and
// restarts the agent service so it picks it up on next start (§16 — the
// admin copies the install command's token here for a node they're adding
// by hand rather than via the full curl|bash installer).
func cmdAgentEnroll(args []string) error {
	fs := flag.NewFlagSet("agent enroll", flag.ContinueOnError)
	token := fs.String("token", "", "one-time enrollment token from the Control Plane's Add Node dialog")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *token == "" {
		return fmt.Errorf("--token is required")
	}
	if os.Geteuid() != 0 {
		return fmt.Errorf("this command must be run as root: sudo mccore agent enroll --token <token>")
	}

	if err := setConfigValue(defaultConfigPath, "AGENT_ENROLLMENT_TOKEN", *token); err != nil {
		return fmt.Errorf("updating config: %w", err)
	}
	fmt.Println("Enrollment token written. Restarting the agent...")
	return restartUnit(unitNames["agent"])
}

// setConfigValue updates or appends a KEY=VALUE line in an env-style file,
// preserving every other line exactly as-is.
func setConfigValue(path, key, value string) error {
	data, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	lines := strings.Split(string(data), "\n")
	found := false
	for i, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), key+"=") {
			lines[i] = key + "=" + value
			found = true
			break
		}
	}
	if !found {
		lines = append(lines, key+"="+value)
	}

	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}
	defer f.Close()
	w := bufio.NewWriter(f)
	for _, l := range lines {
		if _, err := w.WriteString(l + "\n"); err != nil {
			return err
		}
	}
	return w.Flush()
}
