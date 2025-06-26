import type {
  DescribeClustersCommandInput,
  DescribeTasksCommandInput,
  ListClustersCommandInput,
  ListServicesCommandInput,
  ListTasksCommandInput,
} from "@aws-sdk/client-ecs";
import { mockECSClusters, mockECSTasks } from "../mock-data/index.js";

interface MockCommand {
  constructor: { name: string };
  input?: unknown;
}

export class ECSClient {
  send(command: MockCommand) {
    const commandName = command.constructor.name;
    switch (commandName) {
      case "ListClustersCommand":
        return Promise.resolve({
          clusterArns: mockECSClusters.map((c) => c.clusterArn),
        });
      case "DescribeClustersCommand":
        return Promise.resolve({
          clusters: mockECSClusters,
        });
      case "ListServicesCommand": {
        // cluster名でフィルタ
        const clusterTasks = mockECSTasks.filter(
          (t) => t.clusterName === command.input.cluster,
        );
        const uniqueServices = [
          ...new Set(clusterTasks.map((t) => t.serviceName)),
        ];
        return Promise.resolve({
          serviceArns: uniqueServices.map(
            (serviceName) =>
              `arn:aws:ecs:ap-northeast-1:123456789012:service/${command.input.cluster}/${serviceName}`,
          ),
        });
      }
      case "ListTasksCommand":
        // cluster, serviceNameでフィルタ
        return Promise.resolve({
          taskArns: mockECSTasks
            .filter(
              (t) =>
                t.clusterName === command.input.cluster &&
                (!command.input.serviceName ||
                  t.serviceName === command.input.serviceName),
            )
            .map((t) => t.realTaskArn),
        });
      case "DescribeTasksCommand": {
        // getECSTaskContainers用の単独リクエスト
        if (
          command.input.tasks.includes(
            "arn:aws:ecs:us-east-1:123456789012:task/prod-web/1234567890123456789",
          )
        ) {
          return Promise.resolve({
            tasks: [
              {
                taskArn:
                  "arn:aws:ecs:us-east-1:123456789012:task/prod-web/1234567890123456789",
                containers: [
                  {
                    name: "web-container",
                    lastStatus: "RUNNING",
                  },
                ],
              },
            ],
          });
        }

        // cluster, tasksでフィルタ
        const filteredTasks = mockECSTasks.filter((t) =>
          command.input.tasks.includes(t.realTaskArn),
        );
        return Promise.resolve({
          tasks: filteredTasks.map((t) => ({
            taskArn: t.realTaskArn,
            lastStatus: t.taskStatus,
            createdAt: t.createdAt,
            containers: [
              {
                name: "web-container",
                runtimeId: t.runtimeId,
                lastStatus: "RUNNING",
              },
            ],
          })),
        });
      }
      default:
        throw new Error(`Unknown command: ${commandName}`);
    }
  }
}

// コマンドクラスのダミー
export class ListClustersCommand {
  constructor(public input?: ListClustersCommandInput) {}
}
export class DescribeClustersCommand {
  constructor(public input?: DescribeClustersCommandInput) {}
}
export class ListServicesCommand {
  constructor(public input?: ListServicesCommandInput) {}
}
export class ListTasksCommand {
  constructor(public input?: ListTasksCommandInput) {}
}
export class DescribeTasksCommand {
  constructor(public input?: DescribeTasksCommandInput) {}
}
