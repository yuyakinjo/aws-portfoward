import { Argv, Option, Type } from "decopin-cli";

export default function DefineArgv() {
  return (
    <Argv description="Connect to an AWS RDS instance via ECS Exec">
      <Option name="region" alias="r" description="AWS region">
        <Type.String minLength={1} />
      </Option>
      <Option name="cluster" alias="c" description="ECS cluster name">
        <Type.String minLength={1} />
      </Option>
      <Option name="task" alias="t" description="ECS task ID">
        <Type.String minLength={1} />
      </Option>
      <Option name="rds" description="RDS instance identifier">
        <Type.String minLength={1} />
      </Option>
      <Option name="rds-port" description="RDS port number">
        <Type.Number min={1} max={65535} integer />
      </Option>
      <Option name="local-port" alias="p" description="Local port number">
        <Type.Number min={1} max={65535} integer />
      </Option>
    </Argv>
  );
}
