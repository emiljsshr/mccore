//go:build !linux

package cgroup

import (
	"context"
	"fmt"
)

// noopController is used only for local development on non-Linux hosts;
// production always runs cgroup_linux.go (§5: Ubuntu/Debian only).
type noopController struct{}

func NewController() Controller { return &noopController{} }

func (c *noopController) Prepare(_ context.Context, _ string, _ Limits) (string, error) {
	return "", fmt.Errorf("cgroups v2 is only supported on Linux")
}

func (c *noopController) Remove(_ context.Context, _ string) error { return nil }
