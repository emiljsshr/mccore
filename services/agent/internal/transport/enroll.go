package transport

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/cometa-mccore/mccore/services/agent/internal/protocol"
)

// Enroll performs the one-time HTTP exchange of an enrollment token for a
// registered node id (§16/§17). Called once; the enrollment token is
// discarded by the caller immediately afterward (never persisted).
func Enroll(ctx context.Context, controlPlaneURL string, req protocol.EnrollRequest) (protocol.EnrollResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return protocol.EnrollResponse{}, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, controlPlaneURL+"/api/v1/nodes/enroll", bytes.NewReader(body))
	if err != nil {
		return protocol.EnrollResponse{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return protocol.EnrollResponse{}, fmt.Errorf("contacting control plane: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var apiErr struct {
			Error struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&apiErr)
		if apiErr.Error.Message != "" {
			return protocol.EnrollResponse{}, fmt.Errorf("enrollment rejected (%s): %s", apiErr.Error.Code, apiErr.Error.Message)
		}
		return protocol.EnrollResponse{}, fmt.Errorf("enrollment failed: control plane returned HTTP %d", resp.StatusCode)
	}

	var out protocol.EnrollResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return protocol.EnrollResponse{}, fmt.Errorf("decoding enrollment response: %w", err)
	}
	return out, nil
}
