export type NodeStatus = "healthy" | "degraded" | "offline";

export interface McNode {
  id: string;
  name: string;
  location: string;
  status: NodeStatus;
  ipAddress: string;
  os: string;
  kernel: string;
  arch: string;
  cpu: {
    model: string;
    cores: number;
    usagePercent: number;
  };
  memory: {
    usedGb: number;
    totalGb: number;
  };
  disk: {
    usedGb: number;
    totalGb: number;
  };
  network: {
    inMbps: number;
    outMbps: number;
  };
  javaVersions: string[];
  agentVersion: string;
  lastHeartbeat: string;
  serverCount: number;
}
