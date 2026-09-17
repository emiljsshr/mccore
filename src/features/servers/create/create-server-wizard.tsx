"use client";

import { api } from "@/lib/api";
import { useDataStore } from "@/stores/use-data-store";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2 } from "@/lib/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/features/servers/create/stepper";
import { InstallProgress } from "@/features/servers/create/install-progress";
import {
  StepBasics,
  StepGameSettings,
  StepMinecraft,
  StepNetwork,
  StepResources,
  StepReview,
  StepVersion,
} from "@/features/servers/create/wizard-steps";
import { DEFAULT_WIZARD_STATE, type WizardState } from "@/features/servers/create/wizard-state";
import { createServer, CREATE_SERVER_STEPS } from "@/services";

const ALL_STEPS = ["Basics", "Minecraft", "Version", "Resources", "Network", "Game Settings", "Review"] as const;

export function CreateServerWizard() {
  const router = useRouter();
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(() => ({ ...DEFAULT_WIZARD_STATE, nodeId: useDataStore.getState().nodes.find(n => n.status !== "offline")?.id ?? "" }));
  const [installing, setInstalling] = useState(false);
  const [installStep, setInstallStep] = useState(0);
  const installDone = false;

  useEffect(() => {
    api<{ settings: { minecraftDefaults?: { software?: WizardState["software"]; memoryGb?: string; nodeId?: string } } }>("/settings").then(({ settings }) => {
      const defaults = settings.minecraftDefaults;
      if (!defaults) return;
      setState(previous => ({ ...previous,
        software: defaults.software ?? previous.software,
        memoryMaxGb: Number(defaults.memoryGb) || previous.memoryMaxGb,
        nodeId: useDataStore.getState().nodes.some(n => n.id === defaults.nodeId && n.status !== "offline") ? defaults.nodeId! : previous.nodeId,
      }));
    }).catch(() => { /* Users without settings access keep the built-in defaults. */ });
  }, []);

  const isVelocity = state.software === "velocity";
  const visibleSteps = useMemo(
    () => (isVelocity ? ALL_STEPS.filter((s) => s !== "Game Settings") : [...ALL_STEPS]),
    [isVelocity],
  );
  const clampedStep = Math.min(step, visibleSteps.length - 1);
  const currentStepLabel = visibleSteps[clampedStep];
  const isLastStep = clampedStep === visibleSteps.length - 1;

  function update(patch: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  function goNext() {
    if (currentStepLabel === "Basics" && !state.name.trim()) {
      toast.error("Give your server a name first.");
      return;
    }
    if (currentStepLabel === "Version" && !state.minecraftVersion) { toast.error("Select a Minecraft version."); return; }
    setStep((s) => Math.min(s + 1, visibleSteps.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleCreate() {
    if (!eulaAccepted) { toast.error("Accept the Minecraft EULA first."); return; }
    if (!state.nodeId) { toast.error("Select an online node first."); return; }
    setInstalling(true);
    try {
    const server = await createServer(
      {
        eulaAccepted: true,
        name: state.name.trim(),
        description: state.description,
        icon: state.icon,
        software: state.software,
        minecraftVersion: state.minecraftVersion,
        nodeId: state.nodeId,
        memoryMinMb: state.memoryMinGb * 1024,
        memoryMaxMb: state.memoryMaxGb * 1024,
        cpuLimitPercent: state.cpuLimitPercent,
        diskLimitMb: state.diskLimitGb * 1024,
        port: state.port,
        maxPlayers: isVelocity ? 500 : state.maxPlayers,
        gameMode: state.gameMode,
        difficulty: state.difficulty,
        onlineMode: state.onlineMode,
        whitelist: state.whitelist,
        pvp: state.pvp,
        commandBlocks: state.commandBlocks,
        motd: state.motd,
      },
      (index) => setInstallStep(index),
    );
    toast.success(`${server.name}: installation requested`);
    router.push(`/servers/${server.id}`);
    } catch (e) { toast.error((e as Error).message); setInstalling(false); }
  }

  if (installing) {
    return (
      <Card>
        <CardContent>
          <InstallProgress steps={CREATE_SERVER_STEPS} currentStep={installStep} done={installDone} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-6">
        <Stepper steps={[...visibleSteps]} currentStep={clampedStep} />

        <div className="min-h-[360px]">
          <h2 className="mb-4 text-base font-semibold text-foreground">{currentStepLabel}</h2>
          {currentStepLabel === "Basics" && <StepBasics state={state} update={update} />}
          {currentStepLabel === "Minecraft" && <StepMinecraft state={state} update={update} />}
          {currentStepLabel === "Version" && <StepVersion state={state} update={update} />}
          {currentStepLabel === "Resources" && <StepResources state={state} update={update} />}
          {currentStepLabel === "Network" && <StepNetwork state={state} update={update} />}
          {currentStepLabel === "Game Settings" && <StepGameSettings state={state} update={update} />}
          {currentStepLabel === "Review" && <StepReview state={state} update={update} />}
        </div>

        {isLastStep && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={eulaAccepted} onChange={e => setEulaAccepted(e.target.checked)} />I accept the <a href="https://www.minecraft.net/eula" target="_blank" rel="noreferrer" className="underline">Minecraft EULA</a>.</label>}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button variant="outline" onClick={goBack} disabled={clampedStep === 0}>
            <ChevronLeft className="size-4" /> Back
          </Button>
          {isLastStep ? (
            <Button onClick={handleCreate} disabled={installing || !eulaAccepted}>
              {installing && <Loader2 className="size-4 animate-spin" />}
              Create Server
            </Button>
          ) : (
            <Button onClick={goNext}>
              Next <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
