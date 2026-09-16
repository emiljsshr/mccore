package dbadmin

import "testing"

// Manual, opt-in verification against the real local dev database used
// throughout this build's end-to-end testing (see docs/architecture.md).
// Skipped unless MCCORE_TEST_DATABASE_URL is set, since it depends on
// that specific local Postgres instance's state.
func TestLive_RotateBootstrapCode_RefusesWhenSetupComplete(t *testing.T) {
	dsn := "postgresql://mccore:mccore@127.0.0.1:5432/mccore"
	db, err := Connect(dsn)
	if err != nil {
		t.Skipf("local test database not reachable: %v", err)
	}
	defer db.Close()

	count, err := UserCount(db)
	if err != nil {
		t.Fatalf("UserCount failed: %v", err)
	}
	if count == 0 {
		t.Skip("this check only applies once setup has been completed at least once")
	}

	_, _, err = RotateBootstrapCode(db)
	if err == nil {
		t.Fatal("RotateBootstrapCode succeeded even though a user already exists; want a refusal")
	}
	t.Logf("got expected refusal: %v", err)
}
