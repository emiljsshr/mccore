package software

import (
	"context"

	"github.com/cometa-mccore/mccore/services/agent/internal/netdl"
)

// §67: allowlisted download hosts for server software specifically.
// Every provider above only ever constructs URLs against one of these —
// this is the second, independent enforcement point (defense in depth
// alongside "providers never accept a caller-supplied base URL").
var allowedDownloadHosts = map[string]bool{
	"fill-data.papermc.io":   true,
	"api.purpurmc.org":       true,
	"piston-data.mojang.com": true,
}

// Download streams a resolved server-software build to destPath,
// verifying it against whichever checksum the provider gave us.
func Download(ctx context.Context, downloadURL, destPath string, expected ResolvedBuild) error {
	return netdl.Download(ctx, downloadURL, destPath, netdl.Options{
		AllowedHosts: allowedDownloadHosts,
		Expected:     netdl.Expected{Sha256: expected.Sha256, Sha1: expected.Sha1, MD5: expected.MD5},
	})
}
