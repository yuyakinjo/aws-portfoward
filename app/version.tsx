import { Version } from "decopin-cli";
import { VERSION } from "../src/version.js";

export default function DefineVersion() {
  return <Version version={VERSION} name="ecs-pf" />;
}
