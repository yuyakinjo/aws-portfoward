import { useCallback, useState } from "react";
import type { ValidatedExecOptions } from "../../../types.js";

export type ExecStep =
  | "region"
  | "cluster"
  | "task"
  | "container"
  | "command"
  | "exec"
  | "completed";

export interface ExecWorkflowState {
  currentStep: ExecStep;
  region?: string;
  cluster?: string;
  task?: string;
  container?: string;
  command?: string;
  error?: Error;
  options: ValidatedExecOptions;
}

export function useExecWorkflow(initialOptions: ValidatedExecOptions) {
  // Determine initial step based on preset values
  const determineInitialStep = (): ExecStep => {
    if (!initialOptions.region) return "region";
    if (!initialOptions.cluster) return "cluster";
    if (!initialOptions.task) return "task";
    if (!initialOptions.container) return "container";
    if (!initialOptions.command) return "command";
    return "exec";
  };

  const [state, setState] = useState<ExecWorkflowState>({
    currentStep: determineInitialStep(),
    options: initialOptions,
    // Pre-populate from options
    region: initialOptions.region,
    cluster: initialOptions.cluster,
    task: initialOptions.task,
    container: initialOptions.container,
    command: initialOptions.command,
  });

  const updateState = useCallback((updates: Partial<ExecWorkflowState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setRegion = useCallback(
    (region: string) => {
      updateState({
        region,
        currentStep: "cluster",
        error: undefined,
      });
    },
    [updateState],
  );

  const setCluster = useCallback(
    (cluster: string) => {
      updateState({
        cluster,
        currentStep: "task",
        error: undefined,
      });
    },
    [updateState],
  );

  const setTask = useCallback(
    (task: string) => {
      updateState({
        task,
        currentStep: "container",
        error: undefined,
      });
    },
    [updateState],
  );

  const setContainer = useCallback(
    (container: string) => {
      updateState({
        container,
        currentStep: "command",
        error: undefined,
      });
    },
    [updateState],
  );

  const setCommand = useCallback(
    (command: string) => {
      updateState({
        command,
        currentStep: "exec",
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
    (step: ExecStep) => {
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
    setCluster,
    setTask,
    setContainer,
    setCommand,
    setError,
    goToStep,
    complete,
  };
}
