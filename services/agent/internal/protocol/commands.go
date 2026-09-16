package protocol

// Command payload shapes — one struct per `type` in AgentCommandSchema
// (packages/contracts/src/agent-protocol.ts). Unmarshal `Command.Payload`
// into the matching struct based on `Command.Type`.

type ServerInstallPayload struct {
	ServerID         string `json:"serverId"`
	Software         string `json:"software"`
	MinecraftVersion string `json:"minecraftVersion"`
	Build            string `json:"build,omitempty"`
	JavaSelector     string `json:"javaSelector"`
	MemoryMinMb      int    `json:"memoryMinMb"`
	MemoryMaxMb      int    `json:"memoryMaxMb"`
	CPULimitPercent  int    `json:"cpuLimitPercent"`
	DiskLimitMb      int    `json:"diskLimitMb"`
	Port             int    `json:"port"`
	MaxPlayers       int    `json:"maxPlayers"`
	GameMode         string `json:"gameMode"`
	Difficulty       string `json:"difficulty"`
	OnlineMode       bool   `json:"onlineMode"`
	Whitelist        bool   `json:"whitelist"`
	PVP              bool   `json:"pvp"`
	CommandBlocks    bool   `json:"commandBlocks"`
	EulaAccepted     bool   `json:"eulaAccepted"`
	AutoStart        bool   `json:"autoStart"`
}

type ServerIDPayload struct {
	ServerID string `json:"serverId"`
}

type ServerStopPayload struct {
	ServerID          string `json:"serverId"`
	GracePeriodSeconds int   `json:"gracePeriodSeconds"`
}

type ServerDeletePayload struct {
	ServerID    string `json:"serverId"`
	DeleteFiles bool   `json:"deleteFiles"`
}

type ConsoleCommandPayload struct {
	ServerID string `json:"serverId"`
	Command  string `json:"command"`
}

type FilePathPayload struct {
	ServerID string `json:"serverId"`
	Path     string `json:"path"`
}

type FileWritePayload struct {
	ServerID      string `json:"serverId"`
	Path          string `json:"path"`
	ContentBase64 string `json:"contentBase64"`
}

type FileRenamePayload struct {
	ServerID string `json:"serverId"`
	Path     string `json:"path"`
	NewPath  string `json:"newPath"`
}

type BackupCreatePayload struct {
	ServerID        string `json:"serverId"`
	BackupID        string `json:"backupId"`
	IncludesWorlds  bool   `json:"includesWorlds"`
	IncludesPlugins bool   `json:"includesPlugins"`
	IncludesConfig  bool   `json:"includesConfig"`
	Compression     string `json:"compression"`
}

type BackupRestorePayload struct {
	ServerID       string `json:"serverId"`
	BackupID       string `json:"backupId"`
	OperationID    string `json:"operationId"`
	ExpectedSha256 string `json:"expectedSha256,omitempty"`
}

type BackupDeletePayload struct {
	ServerID string `json:"serverId"`
	BackupID string `json:"backupId"`
}

type PluginInstallPayload struct {
	ServerID        string `json:"serverId"`
	OperationID     string `json:"operationId"`
	DownloadURL     string `json:"downloadUrl"`
	ExpectedSha512  string `json:"expectedSha512,omitempty"`
	TargetFileName  string `json:"targetFileName"`
}

type PluginDeletePayload struct {
	ServerID string `json:"serverId"`
	FileName string `json:"fileName"`
}

// ------------------------------------------------------------ Event payloads
// Mirrors the server-side zod schemas in
// apps/control-plane/src/modules/nodes/event-dispatcher.ts.

type ServerStatusEvent struct {
	ServerID string `json:"serverId"`
	Status   string `json:"status"`
	Message  string `json:"message,omitempty"`
	Pid      int    `json:"pid,omitempty"`
}

type ConsoleLine struct {
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Message   string `json:"message"`
}

type ServerConsoleEvent struct {
	ServerID string        `json:"serverId"`
	Lines    []ConsoleLine `json:"lines"`
}

type InstallProgressEvent struct {
	ServerID    string  `json:"serverId"`
	OperationID string  `json:"operationId"`
	Stage       string  `json:"stage"`
	Progress    float64 `json:"progress"`
	Message     string  `json:"message,omitempty"`
}

type ServerMetricsEvent struct {
	ServerID      string  `json:"serverId"`
	CPUPercent    float64 `json:"cpuPercent"`
	MemoryUsedMb  int64   `json:"memoryUsedMb"`
	PlayersOnline int     `json:"playersOnline"`
	TPS           float64 `json:"tps"`
	MSPT          float64 `json:"mspt"`
}

type PlayerEvent struct {
	ServerID string `json:"serverId"`
	UUID     string `json:"uuid"`
	Username string `json:"username"`
}

type BackupProgressEvent struct {
	ServerID       string  `json:"serverId"`
	BackupID       string  `json:"backupId"`
	Stage          string  `json:"stage"`
	Progress       float64 `json:"progress"`
	SizeMb         float64 `json:"sizeMb,omitempty"`
	ChecksumSha256 string  `json:"checksumSha256,omitempty"`
	ErrorMessage   string  `json:"errorMessage,omitempty"`
}

type RestoreProgressEvent struct {
	ServerID    string  `json:"serverId"`
	BackupID    string  `json:"backupId"`
	OperationID string  `json:"operationId"`
	Stage       string  `json:"stage"`
	Progress    float64 `json:"progress"`
	Message     string  `json:"message,omitempty"`
}

type PluginInstallProgressEvent struct {
	ServerID       string  `json:"serverId"`
	OperationID    string  `json:"operationId"`
	FileName       string  `json:"fileName,omitempty"`
	Stage          string  `json:"stage"`
	Progress       float64 `json:"progress"`
	FileSizeMb     float64 `json:"fileSizeMb,omitempty"`
	ChecksumSha256 string  `json:"checksumSha256,omitempty"`
	ErrorMessage   string  `json:"errorMessage,omitempty"`
}
