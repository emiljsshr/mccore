package main

import (
	"flag"
	"fmt"
)

func cmdRestart(args []string) error {
	fs := flag.NewFlagSet("restart", flag.ContinueOnError)
	unitKey := fs.String("unit", "all", "service to restart (control-plane|agent|web|all)")
	if err := fs.Parse(args); err != nil {
		return err
	}

	keys := []string{*unitKey}
	if *unitKey == "all" {
		keys = []string{"control-plane", "agent", "web"}
	}

	for _, key := range keys {
		unit, err := resolveUnit(key)
		if err != nil {
			return err
		}
		fmt.Printf("restarting %s...\n", unit)
		if err := restartUnit(unit); err != nil {
			fmt.Printf("  ✗ %v\n", err)
			continue
		}
		fmt.Printf("  ✓ %s restarted\n", unit)
	}
	return nil
}
