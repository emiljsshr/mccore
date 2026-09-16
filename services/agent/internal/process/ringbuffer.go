package process

import (
	"sync"

	"github.com/cometa-mccore/mccore/services/agent/internal/protocol"
)

// RingBuffer holds the last N console lines in memory (§28 — bounded, not
// an ever-growing log). A fresh browser connection gets exactly this
// snapshot as its backfill; it is never persisted to disk or the database.
const RingBufferCapacity = 500

type RingBuffer struct {
	mu    sync.Mutex
	lines []protocol.ConsoleLine
	start int // index of the oldest line in `lines`
	count int
}

func NewRingBuffer() *RingBuffer {
	return &RingBuffer{lines: make([]protocol.ConsoleLine, RingBufferCapacity)}
}

func (r *RingBuffer) Add(line protocol.ConsoleLine) {
	r.mu.Lock()
	defer r.mu.Unlock()
	idx := (r.start + r.count) % RingBufferCapacity
	r.lines[idx] = line
	if r.count < RingBufferCapacity {
		r.count++
	} else {
		r.start = (r.start + 1) % RingBufferCapacity
	}
}

func (r *RingBuffer) Snapshot() []protocol.ConsoleLine {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]protocol.ConsoleLine, r.count)
	for i := 0; i < r.count; i++ {
		out[i] = r.lines[(r.start+i)%RingBufferCapacity]
	}
	return out
}
