// Package state persists the Agent's local, durable state across restarts:
// its enrolled node id, and the set of Minecraft server processes it
// believes are running (§26 — process recovery). Backed by a single JSON
// file with atomic (write-temp + rename) updates rather than a database,
// since the data is small, low-write-frequency, and only ever read by this
// one process.
package state

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type ServerProcessRecord struct {
	ServerID  string `json:"serverId"`
	Pid       int    `json:"pid"`
	StartedAt string `json:"startedAt"`
	// Cmdline is the resolved argv[0] (the java binary path) used to
	// double check, on recovery, that the PID we find is actually still
	// the process we started and not an unrelated process that happens to
	// have been assigned the same PID after a reboot.
	Cmdline string `json:"cmdline"`
}

type State struct {
	NodeID  string                         `json:"nodeId"`
	Servers map[string]ServerProcessRecord `json:"servers"`
}

type Store struct {
	path string
	mu   sync.Mutex
	data State
}

func Open(statePath string) (*Store, error) {
	if err := os.MkdirAll(statePath, 0700); err != nil {
		return nil, fmt.Errorf("creating state directory: %w", err)
	}
	path := filepath.Join(statePath, "state.json")
	s := &Store{path: path, data: State{Servers: map[string]ServerProcessRecord{}}}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return s, nil
		}
		return nil, fmt.Errorf("reading state file: %w", err)
	}
	if len(data) > 0 {
		if err := json.Unmarshal(data, &s.data); err != nil {
			return nil, fmt.Errorf("parsing state file: %w", err)
		}
	}
	if s.data.Servers == nil {
		s.data.Servers = map[string]ServerProcessRecord{}
	}
	return s, nil
}

func (s *Store) NodeID() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.data.NodeID
}

func (s *Store) SetNodeID(nodeID string) error {
	s.mu.Lock()
	s.data.NodeID = nodeID
	s.mu.Unlock()
	return s.save()
}

func (s *Store) SetServerProcess(rec ServerProcessRecord) error {
	s.mu.Lock()
	s.data.Servers[rec.ServerID] = rec
	s.mu.Unlock()
	return s.save()
}

func (s *Store) ClearServerProcess(serverID string) error {
	s.mu.Lock()
	delete(s.data.Servers, serverID)
	s.mu.Unlock()
	return s.save()
}

func (s *Store) ServerProcesses() map[string]ServerProcessRecord {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make(map[string]ServerProcessRecord, len(s.data.Servers))
	for k, v := range s.data.Servers {
		out[k] = v
	}
	return out
}

// save must be called with s.mu unlocked (it re-marshals data under lock
// internally) and writes atomically: write to a temp file in the same
// directory, then rename — rename is atomic on POSIX filesystems, so a
// crash mid-write never leaves a corrupt state.json.
func (s *Store) save() error {
	s.mu.Lock()
	data, err := json.MarshalIndent(s.data, "", "  ")
	s.mu.Unlock()
	if err != nil {
		return fmt.Errorf("marshaling state: %w", err)
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0600); err != nil {
		return fmt.Errorf("writing temp state file: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return fmt.Errorf("renaming state file: %w", err)
	}
	return nil
}
