import { Box, Text, useApp } from "ink";
import { useMemo } from "react";
import type { ValidatedExecOptions } from "../../../types.js";
import { ProgressWithSelections } from "../../../ui/components/index.js";
import type { StepInfo } from "../../../ui/types.js";
import RegionSelector from "../../connect/ui/RegionSelector.js"; // Reuse region selector
import { useExecWorkflow } from "../hooks/useExecWorkflow.js";
import { CommandInput } from "./CommandInput.js";
import { ContainerSelector } from "./ContainerSelector.js";
import { ECSClusterSelector } from "./ECSClusterSelector.js";
import { ECSTaskSelector } from "./ECSTaskSelector.js";
import { ExecEstablisher } from "./ExecEstablisher.js";

// import { CommandInput } from "./CommandInput.js";
// import { ContainerSelector } from "./ContainerSelector.js";
// import { ECSClusterSelector } from "./ECSClusterSelector.js";
// import { ECSTaskSelector } from "./ECSTaskSelector.js";
// import { ExecEstablisher } from "./ExecEstablisher.js";

interface Props {
  options: ValidatedExecOptions;
}

export const ExecApp = ({ options }: Props) => {
  const { exit } = useApp();
  const {
    state,
    setRegion,
    setCluster,
    setTask,
    setContainer,
    setCommand,
    setError,
    goToStep,
    complete,
  } = useExecWorkflow(options);

  const steps: StepInfo[] = useMemo(
    () => [
      {
        id: "region",
        title: "Select AWS Region",
        completed: !!state.region && state.currentStep !== "region",
        current: state.currentStep === "region",
        value: state.region,
      },
      {
        id: "cluster",
        title: "Select ECS Cluster",
        completed:
          !!state.cluster && !["region", "cluster"].includes(state.currentStep),
        current: state.currentStep === "cluster",
        value: state.cluster,
      },
      {
        id: "task",
        title: "Select ECS Task",
        completed:
          !!state.task &&
          !["region", "cluster", "task"].includes(state.currentStep),
        current: state.currentStep === "task",
        value: state.task,
      },
      {
        id: "container",
        title: "Select Container",
        completed:
          !!state.container &&
          !["region", "cluster", "task", "container"].includes(
            state.currentStep,
          ),
        current: state.currentStep === "container",
        value: state.container,
      },
      {
        id: "command",
        title: "Enter Command",
        completed:
          !!state.command &&
          !["region", "cluster", "task", "container", "command"].includes(
            state.currentStep,
          ),
        current: state.currentStep === "command",
        value: state.command,
      },
    ],
    [state],
  );

  const handleCancel = () => {
    exit();
  };

  const renderCurrentStep = () => {
    switch (state.currentStep) {
      case "region":
        return (
          <RegionSelector
            onSelect={setRegion}
            preselectedRegion={state.region}
            onCancel={handleCancel}
          />
        );

      case "cluster":
        return (
          <ECSClusterSelector
            region={state.region!}
            onSelect={setCluster}
            preselectedCluster={state.cluster}
            onCancel={handleCancel}
            onBack={() => goToStep("region")}
          />
        );

      case "task":
        return (
          <ECSTaskSelector
            region={state.region!}
            cluster={state.cluster!}
            onSelect={setTask}
            preselectedTask={state.task}
            onCancel={handleCancel}
            onBack={() => goToStep("cluster")}
          />
        );

      case "container":
        return (
          <ContainerSelector
            region={state.region!}
            cluster={state.cluster!}
            task={state.task!}
            onSelect={setContainer}
            preselectedContainer={state.container}
            onCancel={handleCancel}
            onBack={() => goToStep("task")}
          />
        );

      case "command":
        return (
          <CommandInput
            defaultCommand={state.command}
            onSelect={setCommand}
            onCancel={handleCancel}
            onBack={() => goToStep("container")}
          />
        );

      case "exec":
        return (
          <ExecEstablisher
            region={state.region || ""}
            cluster={state.cluster || ""}
            task={state.task || ""}
            container={state.container || ""}
            command={state.command || ""}
            isDryRun={state.options.dryRun || false}
            onBack={() => goToStep("command")}
            onComplete={complete}
            onError={(error: string) => setError(new Error(error))}
          />
        );

      case "completed":
        return (
          <Box>
            <Text color="green">
              ✓ Command execution completed successfully!
            </Text>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          AWS ECS Exec v3.0.0 {options.dryRun && "(DRY RUN)"}
        </Text>
      </Box>

      <ProgressWithSelections steps={steps} />

      {state.error && (
        <Box marginTop={1} marginBottom={1}>
          <Text color="red">Error: {state.error.message}</Text>
        </Box>
      )}

      <Box marginTop={1}>{renderCurrentStep()}</Box>
    </Box>
  );
};

export default ExecApp;
