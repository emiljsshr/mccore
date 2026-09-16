// Package java resolves which installed JDK to run a given Minecraft
// server with (§24). It never falls back to a bare `java` on PATH — every
// server gets an explicit, resolved runtime path so upgrading the system's
// default Java can't silently change what a running server uses.
package java

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/cometa-mccore/mccore/services/agent/internal/sysinfo"
)

type Resolver struct {
	installations []sysinfo.JavaInstallation
}

func NewResolver(installations []sysinfo.JavaInstallation) *Resolver {
	return &Resolver{installations: installations}
}

// majorVersion extracts the leading major version number from strings like
// "21.0.4", "17.0.9", "1.8.0_392" (legacy Java 8 versioning).
func majorVersion(version string) (int, error) {
	v := strings.TrimSpace(version)
	if strings.HasPrefix(v, "1.") {
		// Legacy scheme: "1.8.0_392" -> major 8.
		rest := strings.TrimPrefix(v, "1.")
		parts := strings.SplitN(rest, ".", 2)
		return strconv.Atoi(parts[0])
	}
	parts := strings.SplitN(v, ".", 2)
	return strconv.Atoi(parts[0])
}

// Resolve finds an installed JDK matching `selector` (a bare major version
// like "17" or "21"). Exact major-version matches win; if none exists, the
// smallest installed major version *greater* than the selector is used
// (newer JDKs are usually backward compatible for running older server
// jars, whereas an older JDK can't run a server that requires new class
// file features) — never silently falls back to an incompatible or
// arbitrary "whatever's on PATH" runtime.
func (r *Resolver) Resolve(selector string) (sysinfo.JavaInstallation, error) {
	wanted, err := strconv.Atoi(strings.TrimSpace(selector))
	if err != nil {
		return sysinfo.JavaInstallation{}, fmt.Errorf("invalid java selector %q: %w", selector, err)
	}

	var exact *sysinfo.JavaInstallation
	var bestNewer *sysinfo.JavaInstallation
	bestNewerMajor := -1

	for i := range r.installations {
		inst := r.installations[i]
		major, err := majorVersion(inst.Version)
		if err != nil {
			continue
		}
		if major == wanted {
			exact = &r.installations[i]
			break
		}
		if major > wanted && (bestNewerMajor == -1 || major < bestNewerMajor) {
			bestNewerMajor = major
			bestNewer = &r.installations[i]
		}
	}

	if exact != nil {
		return *exact, nil
	}
	if bestNewer != nil {
		return *bestNewer, nil
	}
	return sysinfo.JavaInstallation{}, fmt.Errorf("no installed Java runtime satisfies requirement %q (installed: %s)", selector, describe(r.installations))
}

func describe(installs []sysinfo.JavaInstallation) string {
	if len(installs) == 0 {
		return "none detected"
	}
	parts := make([]string, len(installs))
	for i, inst := range installs {
		parts[i] = inst.Version
	}
	return strings.Join(parts, ", ")
}

// SelectorForMinecraftVersion maps a Minecraft version to the Java major
// version Mojang/PaperMC require for it (§24). This mirrors the well-known
// public compatibility table; unknown/very new versions conservatively
// default to the newest LTS this Agent knows about (21) rather than
// guessing lower and failing at server startup.
func SelectorForMinecraftVersion(minecraftVersion string) string {
	parts := strings.Split(minecraftVersion, ".")
	if len(parts) < 2 {
		return "21"
	}
	minor, err := strconv.Atoi(parts[1])
	if err != nil {
		return "21"
	}
	patch := 0
	if len(parts) >= 3 {
		patch, _ = strconv.Atoi(parts[2])
	}

	switch {
	case minor < 17:
		return "8"
	case minor == 17:
		return "17"
	case minor >= 18 && minor <= 19:
		return "17"
	case minor == 20 && patch < 5:
		return "17"
	default:
		return "21"
	}
}
