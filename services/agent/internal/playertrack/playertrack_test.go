package playertrack

import "testing"

const steveUUID = "069a79f4-44e9-4726-a5be-fca90e38aaf5"

func TestObserveJoinAfterUUIDLine(t *testing.T) {
	tr := NewTracker()

	if ev := tr.Observe("srv1", "[12:00:00 INFO]: UUID of player Steve is "+steveUUID); ev != nil {
		t.Fatalf("UUID line should not itself produce an event, got %+v", ev)
	}

	ev := tr.Observe("srv1", "[12:00:01 INFO]: Steve joined the game")
	if ev == nil {
		t.Fatal("expected a join event")
	}
	if !ev.Joined || ev.Username != "Steve" || ev.UUID != steveUUID {
		t.Errorf("got %+v, want Joined=true Username=Steve UUID=%s", ev, steveUUID)
	}
}

func TestObserveLeaveReusesCachedUUID(t *testing.T) {
	tr := NewTracker()
	tr.Observe("srv1", "[12:00:00 INFO]: UUID of player Steve is "+steveUUID)
	tr.Observe("srv1", "[12:00:01 INFO]: Steve joined the game")

	ev := tr.Observe("srv1", "[12:05:00 INFO]: Steve left the game")
	if ev == nil {
		t.Fatal("expected a leave event")
	}
	if ev.Joined || ev.Username != "Steve" || ev.UUID != steveUUID {
		t.Errorf("got %+v, want Joined=false Username=Steve UUID=%s", ev, steveUUID)
	}
}

func TestObserveJoinWithoutKnownUUIDIsDropped(t *testing.T) {
	tr := NewTracker()
	// No preceding "UUID of player" line for this server/username.
	if ev := tr.Observe("srv1", "[12:00:00 INFO]: Steve joined the game"); ev != nil {
		t.Errorf("expected nil (no cached UUID), got %+v", ev)
	}
}

func TestObserveIgnoresUnrelatedLines(t *testing.T) {
	tr := NewTracker()
	lines := []string{
		"[12:00:00 INFO]: Starting minecraft server version 26.3",
		"[12:00:05 INFO]: <Steve> hello world",
		"[12:00:06 WARN]: Can't keep up! Is the server overloaded?",
	}
	for _, l := range lines {
		if ev := tr.Observe("srv1", l); ev != nil {
			t.Errorf("Observe(%q) = %+v, want nil", l, ev)
		}
	}
}

func TestUUIDCacheIsPerServer(t *testing.T) {
	tr := NewTracker()
	tr.Observe("srv1", "[12:00:00 INFO]: UUID of player Steve is "+steveUUID)

	if ev := tr.Observe("srv2", "[12:00:01 INFO]: Steve joined the game"); ev != nil {
		t.Errorf("srv2 should not see srv1's cached UUID, got %+v", ev)
	}
}

func TestResetClearsCache(t *testing.T) {
	tr := NewTracker()
	tr.Observe("srv1", "[12:00:00 INFO]: UUID of player Steve is "+steveUUID)
	tr.Reset("srv1")

	if ev := tr.Observe("srv1", "[12:00:01 INFO]: Steve joined the game"); ev != nil {
		t.Errorf("expected nil after Reset, got %+v", ev)
	}
}

func TestOnlineCountTracksJoinsAndLeaves(t *testing.T) {
	tr := NewTracker()
	if got := tr.OnlineCount("srv1"); got != 0 {
		t.Fatalf("OnlineCount on unseen server = %d, want 0", got)
	}

	tr.Observe("srv1", "[12:00:00 INFO]: UUID of player Steve is "+steveUUID)
	tr.Observe("srv1", "[12:00:01 INFO]: Steve joined the game")
	if got := tr.OnlineCount("srv1"); got != 1 {
		t.Fatalf("OnlineCount after one join = %d, want 1", got)
	}

	const alexUUID = "a1b2c3d4-e5f6-4789-a012-3456789abcde"
	tr.Observe("srv1", "[12:00:02 INFO]: UUID of player Alex is "+alexUUID)
	tr.Observe("srv1", "[12:00:03 INFO]: Alex joined the game")
	if got := tr.OnlineCount("srv1"); got != 2 {
		t.Fatalf("OnlineCount after two joins = %d, want 2", got)
	}

	tr.Observe("srv1", "[12:05:00 INFO]: Steve left the game")
	if got := tr.OnlineCount("srv1"); got != 1 {
		t.Fatalf("OnlineCount after one leave = %d, want 1", got)
	}

	tr.Reset("srv1")
	if got := tr.OnlineCount("srv1"); got != 0 {
		t.Fatalf("OnlineCount after Reset = %d, want 0", got)
	}
}
