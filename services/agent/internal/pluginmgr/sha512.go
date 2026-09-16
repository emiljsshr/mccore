package pluginmgr

import (
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"io"
	"os"
)

func verifySha512(path, expected string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	h := sha512.New()
	if _, err := io.Copy(h, f); err != nil {
		return err
	}
	got := hex.EncodeToString(h.Sum(nil))
	if got != expected {
		return fmt.Errorf("sha512 mismatch: expected %s, got %s", expected, got)
	}
	return nil
}
