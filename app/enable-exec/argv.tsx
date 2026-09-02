import { Argv, Option, Type } from "decopin-cli";

export default function DefineArgv() {
  return (
    <Argv description="Enable ECS exec for services that don't have it enabled">
      <Option name="region" alias="r" description="AWS region">
        <Type.String minLength={1} />
      </Option>
      <Option name="cluster" alias="c" description="ECS cluster name">
        <Type.String minLength={1} />
      </Option>
      <Option name="service" alias="s" description="ECS service name">
        <Type.String minLength={1} />
      </Option>
    </Argv>
  );
}
