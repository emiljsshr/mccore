import type { OperationDto } from "@mccore/contracts";
import { api } from "@/lib/api";
export async function waitForOperation(id: string, onProgress?: (operation: OperationDto) => void): Promise<OperationDto> {
  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    const { operation } = await api<{ operation: OperationDto }>(`/operations/${id}`);
    onProgress?.(operation);
    if (operation.status === "SUCCEEDED") return operation;
    if (["FAILED", "CANCELLED"].includes(operation.status)) throw new Error(operation.message ?? operation.errorCode ?? "Operation failed.");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("Operation is still running. Check its status on the server page before retrying.");
}
