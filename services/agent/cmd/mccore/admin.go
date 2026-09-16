package main

import (
	"fmt"
	"os"

	"github.com/cometa-mccore/mccore/services/agent/internal/dbadmin"
)

func cmdAdmin(args []string) error {
	if len(args) >= 2 && args[0] == "bootstrap-code" && args[1] == "rotate" {
		return cmdBootstrapCodeRotate()
	}
	return fmt.Errorf("usage: mccore admin bootstrap-code rotate")
}

// cmdBootstrapCodeRotate implements §8. It is the *only* way a bootstrap
// code plaintext ever exists outside a browser's memory — printed once to
// this terminal, never logged, never returned by any HTTP endpoint.
func cmdBootstrapCodeRotate() error {
	if os.Geteuid() != 0 {
		return fmt.Errorf("this command must be run as root (it rotates the platform's setup credential): sudo mccore admin bootstrap-code rotate")
	}

	cfg, err := loadCLIConfig()
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}
	if cfg.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is not configured in %s", defaultConfigPath)
	}

	db, err := dbadmin.Connect(cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("connecting to the database: %w", err)
	}
	defer db.Close()

	code, expiresAt, err := dbadmin.RotateBootstrapCode(db)
	if err != nil {
		return err
	}

	publicURL := cfg.ControlPlaneURL // best available fallback; PUBLIC_URL is what's actually browser-facing when set
	if v := os.Getenv("PUBLIC_URL"); v != "" {
		publicURL = v
	}

	fmt.Println("────────────────────────────────────────")
	fmt.Println(" COMETA mcCORE")
	fmt.Println(" Initial Administrator Setup")
	fmt.Println("────────────────────────────────────────")
	fmt.Println()
	fmt.Println("Open:")
	fmt.Println()
	fmt.Printf("  %s/setup\n", publicURL)
	fmt.Println()
	fmt.Println("Setup Code:")
	fmt.Println()
	fmt.Printf("  %s\n", code)
	fmt.Println()
	fmt.Printf("This code expires at %s (in 30 minutes).\n", expiresAt.Format("15:04:05 MST"))
	fmt.Println()
	fmt.Println("────────────────────────────────────────")
	return nil
}
