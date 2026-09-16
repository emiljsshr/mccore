// Package dbadmin gives the local `mccore` CLI (root-only, §55/§56) direct
// Postgres access for the handful of operations that must never be
// reachable over the network (§8: the bootstrap code "kann nicht über
// Remote API ausgelesen werden") — bootstrap code rotation and local node
// enrollment token creation during install. Everything else the CLI does
// goes through systemctl/HTTP like any other operator tooling.
package dbadmin

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/oklog/ulid/v2"
)

func Connect(databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("opening database connection: %w", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("connecting to database: %w", err)
	}
	return db, nil
}

func newULID() string {
	return ulid.Make().String()
}

const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// generateHumanCode mirrors apps/control-plane/src/lib/tokens.ts
// `generateHumanCode` exactly (128 bits of CSPRNG entropy, Crockford
// Base32, grouped in 4s) — the Control Plane only ever verifies a SHA-256
// hash, so both sides just need to agree on this encoding, which they do.
func generateHumanCode(prefix string) (string, error) {
	buf := make([]byte, 16) // 128 bits
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	bits := new(big.Int).SetBytes(buf)
	five := big.NewInt(32)
	mod := new(big.Int)
	chars := make([]byte, 26)
	for i := 25; i >= 0; i-- {
		bits.DivMod(bits, five, mod)
		chars[i] = crockford[mod.Int64()]
	}
	var groups []string
	for i := 0; i < len(chars); i += 4 {
		end := i + 4
		if end > len(chars) {
			end = len(chars)
		}
		groups = append(groups, string(chars[i:end]))
	}
	return prefix + "-" + strings.Join(groups, "-"), nil
}

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func normalizeCode(code string) string {
	return strings.ToUpper(strings.Join(strings.Fields(strings.TrimSpace(code)), ""))
}

const bootstrapTTL = 30 * time.Minute

// RotateBootstrapCode invalidates any existing unused bootstrap code and
// issues a new one (§8). The plaintext is returned to the caller exactly
// once and is never written to the database or to any log.
func RotateBootstrapCode(db *sql.DB) (code string, expiresAt time.Time, err error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return "", time.Time{}, err
	}
	defer tx.Rollback() //nolint:errcheck

	var userCount int
	if err := tx.QueryRowContext(ctx, `SELECT count(*) FROM "User"`).Scan(&userCount); err != nil {
		return "", time.Time{}, fmt.Errorf("checking existing users: %w", err)
	}
	if userCount > 0 {
		return "", time.Time{}, fmt.Errorf("setup has already been completed — a bootstrap code would have no effect (there is already an administrator account)")
	}

	if _, err := tx.ExecContext(ctx, `UPDATE "BootstrapToken" SET "expiresAt" = now() WHERE "usedAt" IS NULL AND "expiresAt" > now()`); err != nil {
		return "", time.Time{}, fmt.Errorf("invalidating previous codes: %w", err)
	}

	rawCode, err := generateHumanCode("MCCORE")
	if err != nil {
		return "", time.Time{}, fmt.Errorf("generating code: %w", err)
	}
	hash := sha256Hex(normalizeCode(rawCode))
	expiresAt = time.Now().Add(bootstrapTTL)

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO "BootstrapToken" (id, "codeHash", "createdAt", "expiresAt", attempts) VALUES ($1, $2, now(), $3, 0)`,
		newULID(), hash, expiresAt,
	); err != nil {
		return "", time.Time{}, fmt.Errorf("storing new code: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return "", time.Time{}, err
	}
	return rawCode, expiresAt, nil
}

// CreateLocalEnrollmentToken is used once by the installer to enroll the
// machine it's running on as the first node (§15), and can be reused by
// `mccore` for a from-CLI equivalent. `createdByUserId` is nullable at the
// DB level for this one case (the installer runs before any User exists);
// unlike admin-issued tokens (created over the authenticated HTTP API),
// this only ever runs locally as root.
func CreateLocalEnrollmentToken(db *sql.DB, label string, ttl time.Duration) (token string, expiresAt time.Time, err error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", time.Time{}, err
	}
	token = hex.EncodeToString(tokenBytes)
	hash := sha256Hex(token)
	expiresAt = time.Now().Add(ttl)

	_, err = db.ExecContext(ctx,
		`INSERT INTO "EnrollmentToken" (id, label, "tokenHash", "createdByUserId", "createdAt", "expiresAt") VALUES ($1, $2, $3, NULL, now(), $4)`,
		newULID(), label, hash, expiresAt,
	)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("storing enrollment token: %w", err)
	}
	return token, expiresAt, nil
}

func UserCount(db *sql.DB) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var count int
	err := db.QueryRowContext(ctx, `SELECT count(*) FROM "User"`).Scan(&count)
	return count, err
}

func NodeCount(db *sql.DB) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var count int
	err := db.QueryRowContext(ctx, `SELECT count(*) FROM "Node"`).Scan(&count)
	return count, err
}
