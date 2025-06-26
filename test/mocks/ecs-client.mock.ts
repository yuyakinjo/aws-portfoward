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
        const input = command.input as ListServicesCommandInput;
        // cluster名でフィルタ
        const clusterTasks = mockECSTasks.filter(
          (t) => t.clusterName === input.cluster,
        );
        const uniqueServices = [
          ...new Set(clusterTasks.map((t) => t.serviceName)),
        ];
        return Promise.resolve({
          serviceArns: uniqueServices.map(
            (serviceName) =>
              `arn:aws:ecs:ap-northeast-1:123456789012:service/${input.cluster}/${serviceName}`,
          ),
        });
      }
      case "ListTasksCommand": {
        const input = command.input as ListTasksCommandInput;
        // cluster, serviceNameでフィルタ
        const filteredTasks = mockECSTasks.filter(
          (t) =>
            t.clusterName === input.cluster &&
            (!input.serviceName || t.serviceName === input.serviceName),
        );
        const taskArns = filteredTasks.map((t) => t.realTaskArn);
        return Promise.resolve({
          taskArns,
        });
      }
      case "DescribeTasksCommand": {
        const input = command.input as DescribeTasksCommandInput;
        // getECSTaskContainers用の単独リクエスト
        if (
          input.tasks?.includes(
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
          input.tasks?.includes(t.realTaskArn),
        );
        const result = filteredTasks.map((t) => ({
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
        }));
        return Promise.resolve({
          tasks: result,
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
