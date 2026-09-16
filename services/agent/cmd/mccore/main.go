// Command mccore is the local admin CLI (§55). It never talks to the
// Control Plane's HTTP API for the sensitive operations (bootstrap code,
// enrollment tokens) — those go straight to Postgres, and are only ever
// runnable by whoever has local root on the box, matching §8's "kann
// nicht über Remote API ausgelesen werden" requirement. Everything else
// (status/doctor/logs/restart) shells out to systemctl/journalctl with a
// fixed, validated set of unit names — never with user-supplied strings
// interpolated into a command line.
package main

import (
	"fmt"
	"os"
)

const CLIVersion = "0.1.0"

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	var err error
	switch os.Args[1] {
	case "version":
		fmt.Printf("mccore %s\n", CLIVersion)
	case "status":
		err = cmdStatus()
	case "doctor":
		err = cmdDoctor()
	case "logs":
		err = cmdLogs(os.Args[2:])
	case "restart":
		err = cmdRestart(os.Args[2:])
	case "admin":
		err = cmdAdmin(os.Args[2:])
	case "agent":
		err = cmdAgent(os.Args[2:])
	case "update":
		err = cmdUpdate()
	case "uninstall":
		err = cmdUninstall()
	case "help", "-h", "--help":
		printUsage()
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n", os.Args[1])
		printUsage()
		os.Exit(1)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Print(`mccore — mcCore administration CLI

Usage:
  mccore version                         Print the CLI version
  mccore status                          Show service, database and node status
  mccore doctor                          Run diagnostic checks (PASS/WARN/FAIL)
  mccore logs [--unit=control-plane|agent|web] [--follow] [--lines=N]
  mccore restart [--unit=control-plane|agent|web|all]
  mccore admin bootstrap-code rotate     Generate a new setup code (local root only)
  mccore agent status                    Check the local agent's health endpoint
  mccore agent enroll --token <token>    Enroll this node with a Control Plane
  mccore update                          Check for and apply an mcCore update
  mccore uninstall                       Remove mcCore (interactive, destructive parts opt-in)
`)
}
