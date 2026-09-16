package main

import (
	"fmt"
	"net/http"
	"time"

	"github.com/cometa-mccore/mccore/services/agent/internal/dbadmin"
)

func cmdStatus() error {
	cfg, err := loadCLIConfig()
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}

	fmt.Println("mcCore status")
	fmt.Println()

	for _, key := range []string{"control-plane", "agent", "web"} {
		unit := unitNames[key]
		active, detail := isActive(unit)
		symbol := "✗"
		if active {
			symbol = "✓"
		}
		fmt.Printf("  %s %-16s %s (%s)\n", symbol, key, unit, orDash(detail, "active"))
	}

	fmt.Println()
	if cfg.DatabaseURL != "" {
		db, err := dbadmin.Connect(cfg.DatabaseURL)
		if err != nil {
			fmt.Printf("  ✗ database          unreachable: %v\n", err)
		} else {
			defer db.Close()
			users, _ := dbadmin.UserCount(db)
			nodes, _ := dbadmin.NodeCount(db)
			fmt.Printf("  ✓ database          reachable (%d user(s), %d node(s))\n", users, nodes)
		}
	} else {
		fmt.Println("  ? database          DATABASE_URL not configured")
	}

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://" + cfg.HealthListenAddr + "/healthz")
	if err != nil {
		fmt.Printf("  ✗ agent health      unreachable: %v\n", err)
	} else {
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			fmt.Println("  ✓ agent health      connected to control plane")
		} else {
			fmt.Println("  ⚠ agent health      running but not connected to control plane")
		}
	}

	return nil
}

func orDash(s, fallback string) string {
	if s == "" {
		return fallback
	}
	return s
}
