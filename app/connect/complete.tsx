import type { CompleteProps } from "decopin-cli";
import {
  clusterCandidates,
  rdsCandidates,
  regionCandidates,
  taskCandidates,
} from "../_lib/candidates.js";

/** Tab で AWS に聞く。--region を打ってから --cluster、--cluster を打ってから --task */
export default function Complete(props: CompleteProps) {
  switch (props.name) {
    case "region":
      return regionCandidates();
    case "cluster":
      return clusterCandidates(props);
    case "task":
      return taskCandidates(props);
    case "rds":
      return rdsCandidates(props);
    default:
      return [];
  }
}
