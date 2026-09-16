// Package process runs Minecraft server processes directly under the
// mccore user — no shell, ever (§25). Every argv element is a discrete
// string in exec.Cmd.Args; nothing is built by concatenating strings into
// a shell command line.
//
// Stdin is attached to a named pipe (FIFO) at a fixed, deterministic path
// per server rather than an anonymous os/exec pipe. This is what makes
// §26 (surviving an Agent restart) actually work for command delivery: the
// FIFO's read end stays open as long as the Minecraft process is alive
// (it was duped onto the child's fd 0 at exec time), so a *newly started*
// Agent process can reopen the same path for writing and immediately
// resume sending console commands — no in-memory handle needs to survive
// the Agent's own restart. Live stdout/stderr *streaming* does not survive
// an Agent restart in this version (the goroutines reading the old pipe
// die with the old Agent process); this is a documented limitation, not a
// silent one — see docs/architecture.md. The server process itself is
// never touched by an Agent restart, which is the property that actually
// matters (no duplicate processes, no killed servers).
package process

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"golang.org/x/sys/unix"

	"github.com/cometa-mccore/mccore/services/agent/internal/cgroup"
	"github.com/cometa-mccore/mccore/services/agent/internal/protocol"
)

type StartSpec struct {
	ServerID   string
	JavaPath   string
	Args       []string // does NOT include argv[0]; Manager sets that to JavaPath
	WorkDir    string
	StateDir   string // per-server agent state (holds the stdin FIFO)
	CPULimit   int    // percent, 0 = unlimited
	MemoryMaxMb int
}

type managed struct {
	cmd       *exec.Cmd
	pid       int
	startedAt time.Time
	ring      *RingBuffer
	fifoPath  string
	stopCh    chan struct{} // closed once the process has actually exited
}

type ExitInfo struct {
	ServerID string
	Err      error
}

type Manager struct {
	mu       sync.Mutex
	procs    map[string]*managed
	cgroupC  cgroup.Controller
	onLines  func(serverID string, lines []protocol.ConsoleLine)
	onExit   func(info ExitInfo)
}

func NewManager(cgroupController cgroup.Controller, onLines func(string, []protocol.ConsoleLine), onExit func(ExitInfo)) *Manager {
	return &Manager{
		procs:   map[string]*managed{},
		cgroupC: cgroupController,
		onLines: onLines,
		onExit:  onExit,
	}
}

func stdinFifoPath(stateDir, serverID string) string {
	return filepath.Join(stateDir, "servers", serverID, "stdin.fifo")
}

// Start launches java as a direct child process (argv array, no shell) and
// begins streaming its console output. It returns once the process has
// actually started (or failed to).
func (m *Manager) Start(spec StartSpec) (pid int, err error) {
	m.mu.Lock()
	if _, exists := m.procs[spec.ServerID]; exists {
		m.mu.Unlock()
		return 0, fmt.Errorf("server %s already has a managed process", spec.ServerID)
	}
	m.mu.Unlock()

	fifoPath := stdinFifoPath(spec.StateDir, spec.ServerID)
	if err := os.MkdirAll(filepath.Dir(fifoPath), 0700); err != nil {
		return 0, fmt.Errorf("creating stdin fifo directory: %w", err)
	}
	_ = os.Remove(fifoPath) // stale FIFO from a previous run that ended uncleanly
	if err := unix.Mkfifo(fifoPath, 0600); err != nil {
		return 0, fmt.Errorf("creating stdin fifo: %w", err)
	}

	// O_RDWR (not O_RDONLY) avoids blocking here: a FIFO opened read-only
	// blocks until a writer connects, but O_RDWR is satisfied immediately.
	stdinFile, err := os.OpenFile(fifoPath, os.O_RDWR, 0)
	if err != nil {
		return 0, fmt.Errorf("opening stdin fifo: %w", err)
	}

	// argv[0] is the java binary itself; every subsequent element is a
	// discrete, already-validated argument — never a single joined string.
	cmd := exec.Command(spec.JavaPath, spec.Args...)
	cmd.Dir = spec.WorkDir
	cmd.Stdin = stdinFile
	cmd.Env = buildChildEnv(spec.JavaPath, spec.WorkDir)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		stdinFile.Close()
		return 0, fmt.Errorf("creating stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		stdinFile.Close()
		return 0, fmt.Errorf("creating stderr pipe: %w", err)
	}
	applyPlatformProcAttr(cmd)

	if err := cmd.Start(); err != nil {
		stdinFile.Close()
		return 0, fmt.Errorf("starting java process: %w", err)
	}
	// The child has its own duplicate of this fd now; the Agent's copy
	// must be closed so EOF/backpressure behaves correctly.
	stdinFile.Close()

	if m.cgroupC != nil && (spec.CPULimit > 0 || spec.MemoryMaxMb > 0) {
		procsFile, cgErr := m.cgroupC.Prepare(context.Background(), spec.ServerID, cgroup.Limits{MemoryMaxMb: spec.MemoryMaxMb, CPULimitPercent: spec.CPULimit})
		if cgErr != nil {
			fmt.Fprintf(os.Stderr, "warning: cgroup limits unavailable for server %s: %v\n", spec.ServerID, cgErr)
		} else if writeErr := os.WriteFile(procsFile, []byte(fmt.Sprintf("%d", cmd.Process.Pid)), 0644); writeErr != nil {
			fmt.Fprintf(os.Stderr, "warning: could not attach server %s to its cgroup: %v\n", spec.ServerID, writeErr)
		}
	}

	mp := &managed{
		cmd:       cmd,
		pid:       cmd.Process.Pid,
		startedAt: time.Now(),
		ring:      NewRingBuffer(),
		fifoPath:  fifoPath,
		stopCh:    make(chan struct{}),
	}

	m.mu.Lock()
	m.procs[spec.ServerID] = mp
	m.mu.Unlock()

	go m.pumpOutput(spec.ServerID, mp, stdout)
	go m.pumpOutput(spec.ServerID, mp, stderr)
	go m.wait(spec.ServerID, mp)

	return mp.pid, nil
}

// deniedEnvPrefixes are stripped from the Agent's own environment before
// it's handed to a child JVM. This is a denylist, not an allowlist,
// deliberately: an allowlist has to correctly guess every variable a JVM
// might need on every supported OS (verified the hard way — an early
// version of this function hand-picked PATH/HOME/LANG/JAVA_HOME only, and
// the JVM hung indefinitely before ever reaching log4j init because
// something else it silently depends on was missing; see
// docs/architecture.md). Denying specific known-sensitive keys is both
// more robust (nothing to omit by accident) and still meets the actual
// goal — a Minecraft server process must never see the Control Plane's
// database credentials or session/encryption secrets from mccore.env.
var deniedEnvPrefixes = []string{
	"DATABASE_URL=",
	"SESSION_SECRET=",
	"ENCRYPTION_KEY=",
	"AGENT_ENROLLMENT_TOKEN=",
}

// buildChildEnv inherits the Agent's own environment (filtered per
// deniedEnvPrefixes above), then overrides HOME to the server's own
// working directory — a JVM with an inaccessible/nonexistent HOME behaves
// unpredictably during startup, and the server directory is guaranteed to
// exist and be writable, unlike a hardcoded production-only path.
func buildChildEnv(javaPath, workDir string) []string {
	base := os.Environ()
	env := make([]string, 0, len(base)+2)
	for _, kv := range base {
		denied := false
		for _, prefix := range deniedEnvPrefixes {
			if strings.HasPrefix(kv, prefix) {
				denied = true
				break
			}
		}
		if !denied && !strings.HasPrefix(kv, "HOME=") {
			env = append(env, kv)
		}
	}
	env = append(env, "HOME="+workDir)
	if home := filepath.Dir(filepath.Dir(javaPath)); home != "" {
		env = append(env, "JAVA_HOME="+home)
	}
	return env
}

var logLineRe = regexp.MustCompile(`\](\s*(WARN|ERROR|INFO)\s*)\]?:`)

func classifyLevel(line string) protocol.ConsoleLine {
	level := "INFO"
	if m := logLineRe.FindStringSubmatch(line); m != nil {
		level = strings.ToUpper(strings.TrimSpace(m[2]))
	}
	return protocol.ConsoleLine{Level: level, Message: line}
}

func (m *Manager) pumpOutput(serverID string, mp *managed, r io.Reader) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	batch := make([]protocol.ConsoleLine, 0, 32)
	flush := func() {
		if len(batch) == 0 {
			return
		}
		if m.onLines != nil {
			m.onLines(serverID, batch)
		}
		batch = make([]protocol.ConsoleLine, 0, 32)
	}
	ticker := time.NewTicker(150 * time.Millisecond)
	defer ticker.Stop()
	lineCh := make(chan string, 256)
	go func() {
		defer close(lineCh)
		for scanner.Scan() {
			lineCh <- scanner.Text()
		}
	}()
	for {
		select {
		case text, ok := <-lineCh:
			if !ok {
				flush()
				return
			}
			cl := classifyLevel(text)
			cl.ID = fmt.Sprintf("%d-%d", mp.pid, time.Now().UnixNano())
			cl.Timestamp = time.Now().UTC().Format(time.RFC3339Nano)
			mp.ring.Add(cl)
			batch = append(batch, cl)
			if len(batch) >= 32 {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}

func (m *Manager) wait(serverID string, mp *managed) {
	err := mp.cmd.Wait()
	close(mp.stopCh)
	m.mu.Lock()
	delete(m.procs, serverID)
	m.mu.Unlock()
	if m.cgroupC != nil {
		_ = m.cgroupC.Remove(nil, serverID)
	}
	_ = os.Remove(mp.fifoPath)
	if m.onExit != nil {
		m.onExit(ExitInfo{ServerID: serverID, Err: err})
	}
}

// SendCommand writes a single console command line to the server's stdin
// FIFO. Works identically whether the process was started in this Agent
// session or adopted after a restart (§26) — both cases resolve to the
// same deterministic FIFO path.
func (m *Manager) SendCommand(stateDir, serverID, command string) error {
	if strings.ContainsAny(command, "\r\n") {
		return fmt.Errorf("command must not contain newlines")
	}
	path := stdinFifoPath(stateDir, serverID)
	f, err := os.OpenFile(path, os.O_WRONLY, 0)
	if err != nil {
		return fmt.Errorf("server is not running (no stdin fifo): %w", err)
	}
	defer f.Close()
	_, err = f.WriteString(command + "\n")
	return err
}

// Stop sends the Minecraft "stop" console command and waits up to
// gracePeriod for the process to exit on its own before the caller should
// escalate to Kill (§27).
func (m *Manager) Stop(stateDir, serverID string, gracePeriod time.Duration) (exited bool, err error) {
	m.mu.Lock()
	mp, ok := m.procs[serverID]
	m.mu.Unlock()
	if !ok {
		return true, nil // already not running
	}
	if err := m.SendCommand(stateDir, serverID, "stop"); err != nil {
		return false, err
	}
	select {
	case <-mp.stopCh:
		return true, nil
	case <-time.After(gracePeriod):
		return false, nil
	}
}

// Kill immediately terminates the process group (so any child processes
// the JVM spawned die too), bypassing any graceful shutdown.
func (m *Manager) Kill(serverID string) error {
	m.mu.Lock()
	mp, ok := m.procs[serverID]
	m.mu.Unlock()
	if !ok {
		return nil
	}
	return killProcessGroup(mp.pid)
}

func (m *Manager) IsRunning(serverID string) (pid int, running bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	mp, ok := m.procs[serverID]
	if !ok {
		return 0, false
	}
	return mp.pid, true
}

// RunningServerIDs feeds the Agent's heartbeat (§18/§19) so the Control
// Plane can reconcile server status drift.
func (m *Manager) RunningServerIDs() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	ids := make([]string, 0, len(m.procs))
	for id := range m.procs {
		ids = append(ids, id)
	}
	return ids
}

func (m *Manager) ConsoleSnapshot(serverID string) []protocol.ConsoleLine {
	m.mu.Lock()
	mp, ok := m.procs[serverID]
	m.mu.Unlock()
	if !ok {
		return nil
	}
	return mp.ring.Snapshot()
}

// AdoptExisting registers a process this Agent didn't start itself
// (recovered after a restart, §26) so IsRunning/Stop/Kill see it. There is
// no console ring buffer for an adopted process (see package doc) — a
// fresh one starts accumulating from this point forward. Since there's no
// *exec.Cmd to Wait() on for a process we didn't fork, a polling goroutine
// stands in for the exit-detection wait() does for normally-started
// processes.
func (m *Manager) AdoptExisting(serverID string, pid int, stateDir string) {
	m.mu.Lock()
	if _, exists := m.procs[serverID]; exists {
		m.mu.Unlock()
		return
	}
	mp := &managed{
		pid:      pid,
		ring:     NewRingBuffer(),
		fifoPath: stdinFifoPath(stateDir, serverID),
		stopCh:   make(chan struct{}),
	}
	m.procs[serverID] = mp
	m.mu.Unlock()

	go m.pollAdopted(serverID, mp)
}

func (m *Manager) pollAdopted(serverID string, mp *managed) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		if IsAlive(mp.pid, "") {
			continue
		}
		close(mp.stopCh)
		m.mu.Lock()
		delete(m.procs, serverID)
		m.mu.Unlock()
		if m.cgroupC != nil {
			_ = m.cgroupC.Remove(context.Background(), serverID)
		}
		_ = os.Remove(mp.fifoPath)
		if m.onExit != nil {
			m.onExit(ExitInfo{ServerID: serverID, Err: fmt.Errorf("adopted process exited")})
		}
		return
	}
}

func killProcessGroup(pid int) error {
	// Negative pid signals "the whole process group" to Kill/Signal on
	// POSIX systems, which we're able to target because Start sets
	// Setpgid via applyPlatformProcAttr.
	if err := syscall.Kill(-pid, syscall.SIGKILL); err != nil {
		// Fall back to signaling just the one PID (e.g. adopted process
		// group leader lookup failed, or platform doesn't support pgid).
		return syscall.Kill(pid, syscall.SIGKILL)
	}
	return nil
}
