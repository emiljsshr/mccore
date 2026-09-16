package orchestrator

import (
	"encoding/json"

	"github.com/cometa-mccore/mccore/services/agent/internal/fsops"
	"github.com/cometa-mccore/mccore/services/agent/internal/protocol"
)

type fileEntryResult struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	IsDir       bool   `json:"isDir"`
	SizeBytes   int64  `json:"sizeBytes"`
	ModifiedAt  string `json:"modifiedAt"`
	Permissions string `json:"permissions"`
}

func toFileEntryResults(entries []fsops.Entry) []fileEntryResult {
	out := make([]fileEntryResult, len(entries))
	for i, e := range entries {
		out[i] = fileEntryResult{
			Name:        e.Name,
			Path:        e.Path,
			IsDir:       e.IsDir,
			SizeBytes:   e.SizeBytes,
			ModifiedAt:  e.ModifiedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
			Permissions: e.Permissions,
		}
	}
	return out
}

func (o *Orchestrator) handleFileList(cmd protocol.Command) (any, error) {
	var p protocol.FilePathPayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return nil, err
	}
	entries, err := fsops.List(o.serverDir(p.ServerID), p.Path)
	if err != nil {
		return nil, err
	}
	return map[string]any{"entries": toFileEntryResults(entries)}, nil
}

func (o *Orchestrator) handleFileRead(cmd protocol.Command) (any, error) {
	var p protocol.FilePathPayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return nil, err
	}
	content, err := fsops.ReadFileBase64(o.serverDir(p.ServerID), p.Path)
	if err != nil {
		return nil, err
	}
	return map[string]any{"contentBase64": content}, nil
}

func (o *Orchestrator) handleFileWrite(cmd protocol.Command) error {
	var p protocol.FileWritePayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}
	return fsops.WriteFileBase64(o.serverDir(p.ServerID), p.Path, p.ContentBase64)
}

func (o *Orchestrator) handleFileDelete(cmd protocol.Command) error {
	var p protocol.FilePathPayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}
	return fsops.Delete(o.serverDir(p.ServerID), p.Path)
}

func (o *Orchestrator) handleFileRename(cmd protocol.Command) error {
	var p protocol.FileRenamePayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}
	return fsops.Rename(o.serverDir(p.ServerID), p.Path, p.NewPath)
}

func (o *Orchestrator) handleFileMkdir(cmd protocol.Command) error {
	var p protocol.FilePathPayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}
	return fsops.Mkdir(o.serverDir(p.ServerID), p.Path)
}
