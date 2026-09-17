package orchestrator

import (
	"encoding/json"
	"fmt"
	"github.com/cometa-mccore/mccore/services/agent/internal/protocol"
)

func (o *Orchestrator) handleConfigure(cmd protocol.Command) error {
	var p protocol.ServerInstallPayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}
	if _, running := o.procMgr.IsRunning(p.ServerID); running {
		return fmt.Errorf("stop the server before changing configuration")
	}
	if p.MemoryMaxMb < 256 || p.MemoryMaxMb < p.MemoryMinMb || p.CPULimitPercent < 10 {
		return fmt.Errorf("invalid resource limits")
	}
	dir := o.serverDir(p.ServerID)
	current, err := readManifest(dir)
	if err != nil {
		return err
	}
	current.MemoryMaxMb = p.MemoryMaxMb
	current.CPULimitPercent = p.CPULimitPercent
	if current.Software != "velocity" {
		if err := writeServerProperties(dir, p); err != nil {
			return err
		}
	}
	if err := writeServerIcon(dir, p.ServerIconBase64); err != nil {
		return err
	}
	if err := installBridgePlugin(p.Software, dir); err != nil {
		return err
	}
	return writeManifest(dir, current)
}
