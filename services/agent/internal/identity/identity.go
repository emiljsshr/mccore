// Package identity manages the Agent's Ed25519 node identity — see
// docs/architecture.md §2 for why this replaces mTLS. The private key never
// leaves this host and is never transmitted anywhere.
package identity

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
)

type Identity struct {
	PublicKey  ed25519.PublicKey
	PrivateKey ed25519.PrivateKey
}

// LoadOrCreate reads the identity key from <statePath>/identity.key (raw
// 64-byte Ed25519 private key, mode 0600), generating and persisting a new
// one on first run.
func LoadOrCreate(statePath string) (*Identity, error) {
	keyPath := filepath.Join(statePath, "identity.key")

	if data, err := os.ReadFile(keyPath); err == nil {
		if len(data) != ed25519.PrivateKeySize {
			return nil, fmt.Errorf("identity key at %s has unexpected length %d", keyPath, len(data))
		}
		priv := ed25519.PrivateKey(data)
		return &Identity{PublicKey: priv.Public().(ed25519.PublicKey), PrivateKey: priv}, nil
	} else if !os.IsNotExist(err) {
		return nil, fmt.Errorf("reading identity key: %w", err)
	}

	if err := os.MkdirAll(statePath, 0700); err != nil {
		return nil, fmt.Errorf("creating agent state directory: %w", err)
	}
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generating identity key: %w", err)
	}
	// 0600: only the mccore user (which owns this process) may read the
	// private key — never group/world readable.
	if err := os.WriteFile(keyPath, priv, 0600); err != nil {
		return nil, fmt.Errorf("writing identity key: %w", err)
	}
	return &Identity{PublicKey: pub, PrivateKey: priv}, nil
}

func (id *Identity) PublicKeyBase64() string {
	return base64.StdEncoding.EncodeToString(id.PublicKey)
}

// Sign produces the handshake signature over "<nodeId>.<timestamp>.<nonce>",
// matching exactly what the Control Plane reconstructs and verifies
// (apps/control-plane/src/ws/agent-hub.ts `verifyHandshake`).
func (id *Identity) Sign(nodeID string, timestamp int64, nonce string) string {
	message := fmt.Sprintf("%s.%d.%s", nodeID, timestamp, nonce)
	sig := ed25519.Sign(id.PrivateKey, []byte(message))
	return base64.StdEncoding.EncodeToString(sig)
}
