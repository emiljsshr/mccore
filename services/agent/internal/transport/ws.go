// Package transport implements the Agent side of the Control Plane
// protocol (§4/§17/§42): the one-time HTTP enrollment exchange (enroll.go)
// and the persistent, Ed25519-authenticated WebSocket connection used for
// everything after that (this file).
package transport

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	mathrand "math/rand"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"github.com/cometa-mccore/mccore/services/agent/internal/identity"
	"github.com/cometa-mccore/mccore/services/agent/internal/protocol"
)

type CommandHandler func(cmd protocol.Command)

type Client struct {
	controlPlaneURL string
	nodeID          string
	identity        *identity.Identity
	agentVersion    string
	logger          *slog.Logger
	onCommand       CommandHandler

	mu       sync.Mutex
	conn     *websocket.Conn
	writeMu  sync.Mutex
	seq      int
	connected bool
}

func New(controlPlaneURL, nodeID string, id *identity.Identity, agentVersion string, logger *slog.Logger, onCommand CommandHandler) *Client {
	return &Client{
		controlPlaneURL: controlPlaneURL,
		nodeID:          nodeID,
		identity:        id,
		agentVersion:    agentVersion,
		logger:          logger,
		onCommand:       onCommand,
	}
}

func wsURL(controlPlaneURL string) (string, error) {
	u, err := url.Parse(controlPlaneURL)
	if err != nil {
		return "", err
	}
	switch u.Scheme {
	case "https":
		u.Scheme = "wss"
	case "http":
		u.Scheme = "ws"
	default:
		return "", fmt.Errorf("unsupported control plane URL scheme %q", u.Scheme)
	}
	u.Path = strings.TrimSuffix(u.Path, "/") + "/ws/agent"
	return u.String(), nil
}

// Run connects and reconnects for as long as ctx is alive, with
// exponential backoff + jitter between attempts (mirrors the frontend's
// own reconnect policy, §60). It blocks; call it in its own goroutine.
func (c *Client) Run(ctx context.Context) {
	attempt := 0
	for {
		if ctx.Err() != nil {
			return
		}
		err := c.connectAndServe(ctx)
		c.mu.Lock()
		c.connected = false
		c.mu.Unlock()
		if ctx.Err() != nil {
			return
		}
		if err != nil {
			c.logger.Warn("agent connection lost, reconnecting", "error", err, "attempt", attempt+1)
		}
		delay := backoffDelay(attempt)
		attempt++
		select {
		case <-time.After(delay):
		case <-ctx.Done():
			return
		}
	}
}

func backoffDelay(attempt int) time.Duration {
	base := 1 * time.Second
	maxDelay := 60 * time.Second
	d := time.Duration(math.Min(float64(maxDelay), float64(base)*math.Pow(2, float64(attempt))))
	jitter := time.Duration(mathrand.Int63n(int64(d) / 2)) //nolint:gosec // jitter timing only, not security-sensitive
	return d/2 + jitter
}

func (c *Client) connectAndServe(ctx context.Context) error {
	target, err := wsURL(c.controlPlaneURL)
	if err != nil {
		return err
	}

	conn, _, err := websocket.DefaultDialer.DialContext(ctx, target, nil)
	if err != nil {
		return fmt.Errorf("dialing %s: %w", target, err)
	}
	defer conn.Close()

	if err := c.handshake(conn); err != nil {
		return err
	}

	c.mu.Lock()
	c.conn = conn
	c.seq = 0
	c.connected = true
	c.mu.Unlock()
	c.logger.Info("connected to control plane", "url", target)

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			return fmt.Errorf("read: %w", err)
		}
		var frame protocol.OutboundFrame
		if err := json.Unmarshal(data, &frame); err != nil {
			c.logger.Warn("malformed frame from control plane", "error", err)
			continue
		}
		switch frame.Kind {
		case "command":
			if frame.Command != nil && c.onCommand != nil {
				go c.onCommand(*frame.Command)
			}
		default:
			c.logger.Debug("unexpected frame after handshake", "kind", frame.Kind)
		}
	}
}

func (c *Client) handshake(conn *websocket.Conn) error {
	nonce, err := randomNonce()
	if err != nil {
		return err
	}
	timestamp := time.Now().UnixMilli()
	sig := c.identity.Sign(c.nodeID, timestamp, nonce)

	hs := protocol.Handshake{
		NodeID:          c.nodeID,
		Timestamp:       timestamp,
		Nonce:           nonce,
		Signature:       sig,
		AgentVersion:    c.agentVersion,
		ProtocolVersion: protocol.ProtocolVersion,
	}
	if err := conn.WriteJSON(hs); err != nil {
		return fmt.Errorf("sending handshake: %w", err)
	}

	_, data, err := conn.ReadMessage()
	if err != nil {
		return fmt.Errorf("reading handshake response: %w", err)
	}
	var resp protocol.OutboundFrame
	if err := json.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("parsing handshake response: %w", err)
	}
	if resp.Kind == "handshake_error" {
		return fmt.Errorf("handshake rejected (%s): %s", resp.ErrorCode, resp.ErrorMessage)
	}
	if resp.Kind != "handshake_ack" {
		return fmt.Errorf("unexpected handshake response kind %q", resp.Kind)
	}
	return nil
}

func randomNonce() (string, error) {
	b := make([]byte, 18)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (c *Client) IsConnected() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.connected
}

func (c *Client) send(v any) error {
	c.mu.Lock()
	conn := c.conn
	c.mu.Unlock()
	if conn == nil {
		return fmt.Errorf("not connected")
	}
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return conn.WriteJSON(v)
}

func (c *Client) SendAck(commandID string, ok bool, errorCode, errorMessage string, result any) error {
	frame := map[string]any{
		"kind":      "ack",
		"commandId": commandID,
		"ok":        ok,
	}
	if errorCode != "" {
		frame["errorCode"] = errorCode
	}
	if errorMessage != "" {
		frame["errorMessage"] = errorMessage
	}
	if result != nil {
		frame["result"] = result
	}
	return c.send(frame)
}

func (c *Client) SendEvent(eventType string, payload any) error {
	c.mu.Lock()
	c.seq++
	seq := c.seq
	c.mu.Unlock()
	frame := map[string]any{
		"kind":      "event",
		"nodeId":    c.nodeID,
		"seq":       seq,
		"type":      eventType,
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		"payload":   payload,
	}
	return c.send(frame)
}

func (c *Client) SendHeartbeat(hb protocol.Heartbeat) error {
	frame := map[string]any{
		"kind":              "heartbeat",
		"nodeId":            hb.NodeID,
		"agentVersion":      hb.AgentVersion,
		"timestamp":         hb.Timestamp,
		"cpuUsagePercent":   hb.CPUUsagePercent,
		"memoryUsedMb":      hb.MemoryUsedMb,
		"memoryTotalMb":     hb.MemoryTotalMb,
		"diskUsedMb":        hb.DiskUsedMb,
		"diskTotalMb":       hb.DiskTotalMb,
		"loadAverage1m":     hb.LoadAverage1m,
		"networkInMbps":     hb.NetworkInMbps,
		"networkOutMbps":    hb.NetworkOutMbps,
		"javaInstallations": hb.JavaInstallations,
		"runningServerIds":  hb.RunningServerIds,
	}
	return c.send(frame)
}
