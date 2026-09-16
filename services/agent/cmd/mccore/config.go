package main

import "github.com/cometa-mccore/mccore/services/agent/internal/config"

const defaultConfigPath = "/etc/mccore/mccore.env"

func loadCLIConfig() (config.Config, error) {
	return config.Load(defaultConfigPath)
}
