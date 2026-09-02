import { Argv, Option, Type } from "decopin-cli";

export default function DefineArgv() {
  return (
    <Argv description="Execute a command on an AWS ECS task">
      <Option name="region" alias="r" description="AWS region">
        <Type.String minLength={1} />
      </Option>
      <Option name="cluster" alias="c" description="ECS cluster name">
        <Type.String minLength={1} />
      </Option>
      <Option name="task" alias="t" description="ECS task ID">
        <Type.String minLength={1} />
      </Option>
      <Option name="container" description="Container name">
        <Type.String minLength={1} />
      </Option>
      <Option
        name="command"
        description="Command to execute (default: /bin/bash)"
      >
        <Type.String minLength={1} />
      </Option>
    </Argv>
  );
}
