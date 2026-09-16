"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Search,
  Trash2,
  ArrowDownToLine,
  ChevronDown,
  Terminal as TerminalIcon,
} from "@/lib/icons";
import { Terminal } from "@/components/shared/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LOG_LEVEL_CONFIG, LOG_LEVELS } from "@/lib/log-level-config";
import { getConsoleHistory, sendCommand, subscribeToConsole } from "@/services";
import type { ConsoleLine, LogLevel } from "@/types";
import { cn } from "@/lib/utils";

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour12: false });
}

export function ServerConsoleView({ serverId }: { serverId: string }) {
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<Set<LogLevel>>(new Set(LOG_LEVELS));
  const [fullscreen, setFullscreen] = useState(false);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    getConsoleHistory(serverId).then((initial) => {
      if (mounted) setLines(initial);
    });
    return () => {
      mounted = false;
    };
  }, [serverId]);

  useEffect(() => {
    if (paused) return;
    const unsubscribe = subscribeToConsole(serverId, (line) => {
      setLines((prev) => [...prev, line].slice(-500));
    });
    return unsubscribe;
  }, [serverId, paused]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const filteredLines = useMemo(() => {
    return lines.filter((line) => {
      if (!levelFilter.has(line.level)) return false;
      if (search && !line.message.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [lines, levelFilter, search]);

  function toggleLevel(level: LogLevel) {
    setLevelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  function handleClear() {
    setLines([]);
  }

  function handleCopy() {
    const text = filteredLines.map((l) => `[${formatTimestamp(l.timestamp)} ${l.level}]: ${l.message}`).join("\n");
    navigator.clipboard?.writeText(text);
    toast.success("Console output copied");
  }

  async function handleSubmitCommand() {
    const trimmed = command.trim();
    if (!trimmed) return;
    const userLine: ConsoleLine = {
      id: `local-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: "COMMAND",
      message: `> ${trimmed}`,
    };
    setLines((prev) => [...prev, userLine]);
    setHistory((prev) => [trimmed, ...prev].slice(0, 50));
    setHistoryIndex(null);
    setCommand("");

    const response = await sendCommand(serverId, trimmed);
    setLines((prev) => [...prev, response]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleSubmitCommand();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === null ? 0 : Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(nextIndex);
      setCommand(history[nextIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === null) return;
      const nextIndex = historyIndex - 1;
      if (nextIndex < 0) {
        setHistoryIndex(null);
        setCommand("");
      } else {
        setHistoryIndex(nextIndex);
        setCommand(history[nextIndex]);
      }
    }
  }

  return (
    <Terminal
      fullscreen={fullscreen}
      toolbar={
        <>
          <TerminalIcon className="size-3.5 text-white/40" />
          <span className="text-xs font-medium text-white/70">Console</span>
          <div className="mx-1 h-4 w-px bg-white/10" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white/60 hover:bg-white/10 hover:text-white"
                onClick={() => setPaused((p) => !p)}
              >
                {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{paused ? "Resume live feed" : "Pause live feed"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn("text-white/60 hover:bg-white/10 hover:text-white", autoScroll && "text-emerald-400")}
                onClick={() => setAutoScroll((v) => !v)}
              >
                <ArrowDownToLine className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{autoScroll ? "Auto-scroll on" : "Auto-scroll off"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white/60 hover:bg-white/10 hover:text-white"
                onClick={handleClear}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white/60 hover:bg-white/10 hover:text-white"
                onClick={handleCopy}
              >
                <Copy className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy output</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-white/60 hover:bg-white/10 hover:text-white">
                Levels <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Log levels</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LOG_LEVELS.map((level) => (
                <DropdownMenuCheckboxItem
                  key={level}
                  checked={levelFilter.has(level)}
                  onCheckedChange={() => toggleLevel(level)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {LOG_LEVEL_CONFIG[level].label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-white/40" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="h-7 w-40 border-white/10 bg-white/5 pl-6 text-xs text-white placeholder:text-white/30 focus-visible:ring-white/20"
              />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white/60 hover:bg-white/10 hover:text-white"
                  onClick={() => setFullscreen((v) => !v)}
                >
                  {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{fullscreen ? "Exit fullscreen" : "Fullscreen"}</TooltipContent>
            </Tooltip>
          </div>
        </>
      }
      footer={
        <div className="flex items-center gap-2">
          <span className="pl-2 text-xs font-medium text-emerald-400">/</span>
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter server command..."
            className="h-8 border-none bg-transparent font-mono text-xs text-white shadow-none placeholder:text-white/30 focus-visible:ring-0"
          />
        </div>
      }
    >
      <div ref={scrollRef} className="h-full overflow-y-auto">
        {filteredLines.length === 0 ? (
          <p className="text-white/30">No log lines match the current filters.</p>
        ) : (
          filteredLines.map((line) => {
            const config = LOG_LEVEL_CONFIG[line.level];
            return (
              <div key={line.id} className="flex gap-2 py-0.5">
                <span className="shrink-0 text-white/30">[{formatTimestamp(line.timestamp)}</span>
                <span className={cn("shrink-0 font-semibold", config.className)}>{config.label}]:</span>
                <span
                  className={cn(
                    "min-w-0 flex-1 break-all text-white/80",
                    line.level === "CHAT" && "text-sky-200",
                    line.level === "ERROR" && "text-red-300",
                  )}
                >
                  {line.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </Terminal>
  );
}
