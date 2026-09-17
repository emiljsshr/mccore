// Package playertrack detects player join/leave events by scanning a
// Minecraft server's own console output. There is no RCON or query-protocol
// integration (see docs/architecture.md's note on the not-yet-built mcCore
// Bridge plugin), so the vanilla/Paper server log lines it already prints
// for every login are the only source of truth this Agent has for who is
// currently connected:
//
//	[HH:MM:SS INFO]: UUID of player Steve is 069a79f4-44e9-4726-a5be-fca90e38aaf5
//	[HH:MM:SS INFO]: Steve joined the game
//	[HH:MM:SS INFO]: Steve left the game
//
// The control plane needs a UUID for both join and leave (it looks players
// up by UUID, not username — see onPlayerJoin/onPlayerLeave in
// event-dispatcher.ts), but only the login line ever prints one, so this
// package caches username->UUID per server between the two.
package playertrack

import (
	"regexp"
	"sync"
)

var (
	uuidLineRe  = regexp.MustCompile(`UUID of player (\S+) is ([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})`)
	joinLineRe  = regexp.MustCompile(`(\S+) joined the game$`)
	leaveLineRe = regexp.MustCompile(`(\S+) left the game$`)
)

// Event is a detected join or leave, ready to send as a "player.join" or
// "player.leave" protocol.PlayerEvent.
type Event struct {
	UUID     string
	Username string
	Joined   bool // true = join, false = leave
}

// Tracker caches each server's currently-known username->UUID mappings.
// Safe for concurrent use — console lines for different servers are
// processed on different goroutines.
type Tracker struct {
	mu    sync.Mutex
	uuids map[string]map[string]string // serverID -> username -> uuid
}

func NewTracker() *Tracker {
	return &Tracker{uuids: make(map[string]map[string]string)}
}

// Observe scans one console line for a UUID announcement or a join/leave,
// returning the resulting Event, or nil if the line is neither (the
// overwhelming majority of lines: this is called for every line of a
// running server's output).
func (t *Tracker) Observe(serverID, line string) *Event {
	if m := uuidLineRe.FindStringSubmatch(line); m != nil {
		t.mu.Lock()
		if t.uuids[serverID] == nil {
			t.uuids[serverID] = make(map[string]string)
		}
		t.uuids[serverID][m[1]] = m[2]
		t.mu.Unlock()
		return nil
	}
	if m := joinLineRe.FindStringSubmatch(line); m != nil {
		if uuid, ok := t.lookup(serverID, m[1]); ok {
			return &Event{UUID: uuid, Username: m[1], Joined: true}
		}
		return nil
	}
	if m := leaveLineRe.FindStringSubmatch(line); m != nil {
		if uuid, ok := t.lookup(serverID, m[1]); ok {
			return &Event{UUID: uuid, Username: m[1], Joined: false}
		}
		return nil
	}
	return nil
}

func (t *Tracker) lookup(serverID, username string) (string, bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	byUsername, ok := t.uuids[serverID]
	if !ok {
		return "", false
	}
	uuid, ok := byUsername[username]
	return uuid, ok
}

// Reset drops a server's cached UUIDs — called when its process exits, so a
// stale mapping from a previous run is never attributed to a differently
// behaving restart.
func (t *Tracker) Reset(serverID string) {
	t.mu.Lock()
	delete(t.uuids, serverID)
	t.mu.Unlock()
}
