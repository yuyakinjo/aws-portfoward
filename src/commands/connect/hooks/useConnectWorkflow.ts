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
  const [state, setState] = useState<ConnectWorkflowState>({
    currentStep: "region",
    options: initialOptions,
    // Pre-populate from options
    region: initialOptions.region,
    rds: initialOptions.rds,
    rdsPort: initialOptions.rdsPort?.toString(),
    ecsCluster: initialOptions.cluster,
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
      updateState({ currentStep: step, error: undefined });
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
