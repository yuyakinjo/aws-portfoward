import { useCallback, useState } from "react";
import type { RDSInstance, ValidatedConnectOptions } from "../../../types.js";

export type ConnectStep =
  | "region"
  | "rds"
  | "ecs"
  | "localPort"
  | "connect"
  | "completed";

export interface ConnectWorkflowState {
  currentStep: ConnectStep;
  region?: string;
  rds?: string;
  rdsPort?: string;
  ecsTarget?: string;
  ecsCluster?: string;
  localPort?: string;
  error?: Error;
  options: ValidatedConnectOptions;
}

export function useConnectWorkflow(initialOptions: ValidatedConnectOptions) {
  // Determine initial step based on preset values
  const determineInitialStep = (): ConnectStep => {
    if (!initialOptions.region) return "region";
    if (!initialOptions.rds) return "rds";
    if (!initialOptions.cluster || !initialOptions.task) return "ecs";
    if (!initialOptions.localPort) return "localPort";
    return "connect";
  };

  const [state, setState] = useState<ConnectWorkflowState>({
    currentStep: determineInitialStep(),
    options: initialOptions,
    // Pre-populate from options
    region: initialOptions.region,
    rds: initialOptions.rds,
    rdsPort: initialOptions.rdsPort?.toString() || "5432", // Default to PostgreSQL port
    ecsCluster: initialOptions.cluster,
    ecsTarget: initialOptions.task, // task should be mapped to ecsTarget
    localPort: initialOptions.localPort?.toString(),
  });

  const updateState = useCallback((updates: Partial<ConnectWorkflowState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setRegion = useCallback(
    (region: string) => {
      updateState({
        region,
        currentStep: "rds",
        error: undefined,
      });
    },
    [updateState],
  );

  const setRDS = useCallback(
    (rdsInstance: RDSInstance, rdsPort: string) => {
      updateState({
        rds: rdsInstance.dbInstanceIdentifier,
        rdsPort,
        currentStep: "ecs",
        error: undefined,
      });
    },
    [updateState],
  );

  const setECSTarget = useCallback(
    (ecsTarget: string, ecsCluster: string) => {
      updateState({
        ecsTarget,
        ecsCluster,
        currentStep: "localPort",
        error: undefined,
      });
    },
    [updateState],
  );

  const setLocalPort = useCallback(
    (localPort: string) => {
      updateState({
        localPort,
        currentStep: "connect",
        error: undefined,
      });
    },
    [updateState],
  );

  const setError = useCallback(
    (error: Error) => {
      updateState({ error });
    },
    [updateState],
  );

  const goToStep = useCallback(
    (step: ConnectStep) => {
      // 前のステップに戻る際は、後続のステップのデータをクリア
      const updates: Partial<ConnectWorkflowState> = {
        currentStep: step,
        error: undefined,
      };

      // 各ステップに戻る際に、後続のデータをクリア
      switch (step) {
        case "region":
          updates.rds = undefined;
          updates.rdsPort = undefined;
          updates.ecsTarget = undefined;
          updates.ecsCluster = undefined;
          updates.localPort = undefined;
          break;
        case "rds":
          updates.ecsTarget = undefined;
          updates.ecsCluster = undefined;
          updates.localPort = undefined;
          break;
        case "ecs":
          updates.localPort = undefined;
          break;
      }

      updateState(updates);
    },
    [updateState],
  );

  const complete = useCallback(() => {
    updateState({ currentStep: "completed" });
  }, [updateState]);

  return {
    state,
    setRegion,
    setRDS,
    setECSTarget,
    setLocalPort,
    setError,
    goToStep,
    complete,
  };
}
