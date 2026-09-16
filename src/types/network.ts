export interface McNetwork {
  id: string;
  name: string;
  description?: string;
  proxyServerId: string;
  connectedServerIds: string[];
  createdAt: string;
}
