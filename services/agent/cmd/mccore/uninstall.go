package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"
	"time"
)

// cmdUninstall implements §59: interactive by design, defaults to keeping
// Minecraft servers and backups, and never deletes anything destructive
// without an explicit "yes" typed for that specific category.
func cmdUninstall() error {
	if os.Geteuid() != 0 {
		return fmt.Errorf("this command must be run as root: sudo mccore uninstall")
	}

	reader := bufio.NewReader(os.Stdin)
	ask := func(question string) bool {
		fmt.Printf("%s [y/N]: ", question)
		line, _ := reader.ReadString('\n')
		return strings.EqualFold(strings.TrimSpace(line), "y") || strings.EqualFold(strings.TrimSpace(line), "yes")
	}

	fmt.Println("mcCore Uninstall")
	fmt.Println()
	fmt.Println("This will stop and remove the mcCore application (services, systemd")
	fmt.Println("units, /opt/mccore). Minecraft servers and backups are KEPT by default.")
	fmt.Println()

	if !ask("Continue with uninstalling mcCore?") {
		fmt.Println("Aborted.")
		return nil
	}

	removeServers := ask("Also DELETE all Minecraft server data (/var/lib/mccore/servers)? This cannot be undone.")
	removeBackups := ask("Also DELETE all backups (/var/lib/mccore/backups)? This cannot be undone.")
	removeDatabase := ask("Also DROP the mcCore database? This cannot be undone.")

	fmt.Println()
	fmt.Println("Stopping services...")
	for _, key := range []string{"agent", "control-plane", "web"} {
		unit := unitNames[key]
		if active, _ := isActive(unit); active {
			if _, err := systemctlBackground("stop", unit); err != nil {
				fmt.Printf("  ⚠ could not stop %s cleanly: %v\n", unit, err)
			}
		}
	}

	fmt.Println("Disabling and removing systemd units...")
	for _, key := range []string{"agent", "control-plane", "web"} {
		unit := unitNames[key]
		_, _ = systemctlBackground("disable", unit)
		_ = os.Remove("/etc/systemd/system/" + unit)
	}

	fmt.Println("Removing application files (/opt/mccore)...")
	_ = os.RemoveAll("/opt/mccore")

	if removeServers {
		fmt.Println("Removing Minecraft server data (/var/lib/mccore/servers)...")
		_ = os.RemoveAll("/var/lib/mccore/servers")
	} else {
		fmt.Println("Keeping /var/lib/mccore/servers.")
	}

	if removeBackups {
		fmt.Println("Removing backups (/var/lib/mccore/backups)...")
		_ = os.RemoveAll("/var/lib/mccore/backups")
	} else {
		fmt.Println("Keeping /var/lib/mccore/backups.")
	}

	if removeDatabase {
		cfg, err := loadCLIConfig()
		if err == nil && cfg.DatabaseURL != "" {
			fmt.Println("Dropping the database was requested but is not automated by this")
			fmt.Println("command (destructive, connection-string-dependent) — drop it manually")
			fmt.Println("with the credentials in your original /etc/mccore/mccore.env if you")
			fmt.Println("still have a copy, e.g.: dropdb <database name>")
		}
	}

	fmt.Println()
	fmt.Println("mcCore has been uninstalled.")
	if !removeServers || !removeBackups {
		fmt.Println("Server/backup data that was kept remains under /var/lib/mccore.")
	}
	return nil
}

func systemctlBackground(args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	return systemctl(ctx, args...)
}
