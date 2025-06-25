import { Box, Text, useApp } from "ink";
import { useEffect, useMemo, useState } from "react";
import type { InferenceResult } from "../../../inference/index.js";
import type { RDSInstance, ValidatedConnectOptions } from "../../../types.js";
import { ProgressWithSelections } from "../../../ui/components/index.js";
import type { StepInfo } from "../../../ui/types.js";
import { useConnectWorkflow } from "../hooks/useConnectWorkflow.js";
import { ConnectionEstablisher } from "./ConnectionEstablisher.js";
import { ECSSelector } from "./ECSSelector.js";
import { LocalPortSelector } from "./LocalPortSelector.js";
import RDSSelector from "./RDSSelector.js";
import RegionSelector from "./RegionSelector.js";

interface Props {
  options: ValidatedConnectOptions;
}

export const ConnectApp = ({ options }: Props) => {
  const { exit } = useApp();
  const {
    state,
    setRegion,
    setRDS,
    setECSTarget,
    setLocalPort,
    setError,
    goToStep,
    complete,
  } = useConnectWorkflow(options);

  // RDSインスタンス情報を保持するための状態
  const [selectedRDSInstance, setSelectedRDSInstance] =
    useState<RDSInstance | null>(null);

  // ECS推論結果を保持するための状態
  const [selectedInferenceResult, setSelectedInferenceResult] =
    useState<InferenceResult | null>(null);

  // プリセット値がある場合のRDSインスタンス情報の復元
  useEffect(() => {
    if (state.rds && !selectedRDSInstance) {
      // 注意: 実際の実装では、RDSインスタンス情報をAPIから取得する必要があります
      // ここでは簡易的な実装として、最低限の情報を設定します
      const mockRDSInstance: RDSInstance = {
        dbInstanceIdentifier: state.rds,
        endpoint: `${state.rds}.cluster-xyz.region.rds.amazonaws.com`,
        port: parseInt(state.rdsPort || "5432"), // PostgreSQL default port
        engine: "postgres", // Default to postgres for pcmprodstack
        dbInstanceClass: "db.t3.micro",
        dbInstanceStatus: "available",
        allocatedStorage: 20,
        availabilityZone: `${state.region}a`,
        vpcSecurityGroups: [],
      };
      setSelectedRDSInstance(mockRDSInstance);
    }
  }, [state.rds, state.rdsPort, state.region, selectedRDSInstance]);

  // プリセット値がある場合のECS推論結果の復元
  useEffect(() => {
    if (state.ecsTarget && state.ecsCluster && !selectedInferenceResult) {
      // 注意: 実際の実装では、ECS推論結果をAPIから取得する必要があります
      // ここでは簡易的な実装として、最低限の情報を設定します
      const mockInferenceResult: InferenceResult = {
        cluster: {
          clusterName: state.ecsCluster,
          clusterArn: `arn:aws:ecs:${state.region}:account:cluster/${state.ecsCluster}`,
        },
        task: {
          taskArn: state.ecsTarget, // Use the task ARN directly
          realTaskArn: state.ecsTarget,
          displayName: state.ecsTarget,
          runtimeId: "runtime-id",
          taskId: "task-id",
          clusterName: state.ecsCluster,
          serviceName: state.ecsTarget,
          taskStatus: "RUNNING",
        },
        confidence: "high" as const,
        method: "environment",
        score: 1.0,
        reason: "Restored from preset values",
      };
      setSelectedInferenceResult(mockInferenceResult);
    }
  }, [
    state.ecsTarget,
    state.ecsCluster,
    state.region,
    selectedInferenceResult,
  ]);

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
        id: "rds",
        title: "Select RDS Instance",
        completed:
          !!state.rds && !["region", "rds"].includes(state.currentStep),
        current: state.currentStep === "rds",
        value: state.rds,
      },
      {
        id: "ecs",
        title: "Select ECS Target",
        completed:
          !!state.ecsTarget &&
          !["region", "rds", "ecs"].includes(state.currentStep),
        current: state.currentStep === "ecs",
        value: state.ecsTarget,
      },
      {
        id: "localPort",
        title: "Select Local Port",
        completed:
          !!state.localPort &&
          !["region", "rds", "ecs", "localPort"].includes(state.currentStep),
        current: state.currentStep === "localPort",
        value: state.localPort,
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

      case "rds":
        return (
          <RDSSelector
            region={state.region!}
            onSelect={(rdsInstance, rdsPort) => {
              setSelectedRDSInstance(rdsInstance);
              setRDS(rdsInstance, rdsPort);
            }}
            preselectedRDS={state.rds}
            onCancel={handleCancel}
            onBack={() => goToStep("region")}
          />
        );

      case "ecs":
        if (!selectedRDSInstance) {
          return (
            <Box>
              <Text color="red">Error: RDS instance not selected</Text>
            </Box>
          );
        }
        return (
          <ECSSelector
            region={state.region!}
            rdsInstance={selectedRDSInstance}
            presetCluster={state.ecsCluster}
            presetTask={state.options.task}
            onSelect={(result: InferenceResult) => {
              setSelectedInferenceResult(result);
              setECSTarget(result.task.serviceName, result.cluster.clusterName);
            }}
            onBack={() => goToStep("rds")}
            onError={(error: string) => setError(new Error(error))}
          />
        );

      case "localPort":
        return (
          <LocalPortSelector
            defaultPort={state.localPort}
            onSelect={setLocalPort}
            onBack={() => goToStep("ecs")}
            onError={(error: string) => setError(new Error(error))}
          />
        );

      case "connect":
        // データが準備できるまで待つ
        if (state.rds && !selectedRDSInstance) {
          return (
            <Box>
              <Text color="yellow">Preparing RDS instance data...</Text>
            </Box>
          );
        }
        if (state.ecsTarget && !selectedInferenceResult) {
          return (
            <Box>
              <Text color="yellow">Preparing ECS target data...</Text>
            </Box>
          );
        }
        if (!selectedRDSInstance || !selectedInferenceResult) {
          return (
            <Box>
              <Text color="red">Error: Required data not available</Text>
            </Box>
          );
        }
        return (
          <ConnectionEstablisher
            region={state.region!}
            rdsInstance={selectedRDSInstance}
            rdsPort={state.rdsPort!}
            inferenceResult={selectedInferenceResult}
            localPort={state.localPort!}
            isDryRun={state.options.dryRun || false}
            onBack={() => goToStep("localPort")}
            onComplete={complete}
            onError={(error: string) => setError(new Error(error))}
          />
        );

      case "completed":
        return (
          <Box>
            <Text color="green">✓ Connection established successfully!</Text>
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
          AWS Port Forward v3.0.0 {options.dryRun && "(DRY RUN)"}
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

export default ConnectApp;
