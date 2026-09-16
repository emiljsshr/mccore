// Package protocol mirrors packages/contracts/src/agent-protocol.ts field for
// field. This file IS the Go side of that shared contract — if the TS
// schemas change, this must change with them. JSON field names are
// hand-verified against the zod schemas, not derived automatically, so any
// edit here must be cross-checked against agent-protocol.ts.
package protocol

import "encoding/json"

const ProtocolVersion = 1

// ---------------------------------------------------------------- Handshake

type Handshake struct {
	NodeID          string `json:"nodeId"`
	Timestamp       int64  `json:"timestamp"`
	Nonce           string `json:"nonce"`
	Signature       string `json:"signature"`
	AgentVersion    string `json:"agentVersion"`
	ProtocolVersion int    `json:"protocolVersion"`
}

type JavaInstallation struct {
	Version string `json:"version"`
	Path    string `json:"path"`
	Vendor  string `json:"vendor,omitempty"`
}

type EnrollRequest struct {
	EnrollmentToken   string              `json:"enrollmentToken"`
	PublicKey         string              `json:"publicKey"`
	Hostname          string              `json:"hostname"`
	OS                string              `json:"os"`
	Kernel            string              `json:"kernel"`
	Arch              string              `json:"arch"`
	CPUModel          string              `json:"cpuModel"`
	CPUCores          int                 `json:"cpuCores"`
	MemoryTotalMb     int64               `json:"memoryTotalMb"`
	DiskTotalMb       int64               `json:"diskTotalMb"`
	IPAddress         string              `json:"ipAddress"`
	JavaInstallations []JavaInstallation  `json:"javaInstallations"`
	AgentVersion      string              `json:"agentVersion"`
	ProtocolVersion   int                 `json:"protocolVersion"`
}

type EnrollResponse struct {
	NodeID   string `json:"nodeId"`
	NodeName string `json:"nodeName"`
}

// ----------------------------------------------------------------- Heartbeat

type Heartbeat struct {
	NodeID            string             `json:"nodeId"`
	AgentVersion      string             `json:"agentVersion"`
	Timestamp         string             `json:"timestamp"`
	CPUUsagePercent   float64            `json:"cpuUsagePercent"`
	MemoryUsedMb      int64              `json:"memoryUsedMb"`
	MemoryTotalMb     int64              `json:"memoryTotalMb"`
	DiskUsedMb        int64              `json:"diskUsedMb"`
	DiskTotalMb       int64              `json:"diskTotalMb"`
	LoadAverage1m     float64            `json:"loadAverage1m"`
	NetworkInMbps     float64            `json:"networkInMbps"`
	NetworkOutMbps    float64            `json:"networkOutMbps"`
	JavaInstallations []JavaInstallation `json:"javaInstallations"`
	RunningServerIds  []string           `json:"runningServerIds"`
}

// ------------------------------------------------------------------ Frames

// InboundFrame is what the Agent sends to the Control Plane (kind: ack | event | heartbeat).
type InboundFrame struct {
	Kind string `json:"kind"`

	// ack fields
	CommandID    string          `json:"commandId,omitempty"`
	Ok           bool            `json:"ok,omitempty"`
	ErrorCode    string          `json:"errorCode,omitempty"`
	ErrorMessage string          `json:"errorMessage,omitempty"`
	Result       json.RawMessage `json:"result,omitempty"`

	// event fields
	Seq       int             `json:"seq,omitempty"`
	Type      string          `json:"type,omitempty"`
	Timestamp string          `json:"timestamp,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`

	// heartbeat fields flatten Heartbeat inline via a separate send path (see transport)
}

// OutboundFrame is what the Control Plane sends to the Agent.
type OutboundFrame struct {
	Kind         string          `json:"kind"`
	NodeID       string          `json:"nodeId,omitempty"`
	ErrorCode    string          `json:"errorCode,omitempty"`
	ErrorMessage string          `json:"errorMessage,omitempty"`
	Command      *Command        `json:"command,omitempty"`
}

type Command struct {
	CommandID string          `json:"commandId"`
	Type      string          `json:"type"`
	IssuedAt  string          `json:"issuedAt"`
	Payload   json.RawMessage `json:"payload"`
}
