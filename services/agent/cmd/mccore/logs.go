package main

import (
	"flag"
	"fmt"
)

func cmdLogs(args []string) error {
	fs := flag.NewFlagSet("logs", flag.ContinueOnError)
	unitKey := fs.String("unit", "control-plane", "service to show logs for (control-plane|agent|web)")
	follow := fs.Bool("follow", false, "follow log output")
	lines := fs.Int("lines", 100, "number of lines to show")
	if err := fs.Parse(args); err != nil {
		return err
	}

	unit, err := resolveUnit(*unitKey)
	if err != nil {
		return err
	}
	fmt.Printf("── %s (%s) ──\n", *unitKey, unit)
	return journalctlTail(unit, *lines, *follow)
}
