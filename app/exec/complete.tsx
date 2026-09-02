import type { CompleteProps } from "decopin-cli";
import {
  clusterCandidates,
  regionCandidates,
  taskCandidates,
} from "../_lib/candidates.js";

export default function Complete(props: CompleteProps) {
  switch (props.name) {
    case "region":
      return regionCandidates();
    case "cluster":
      return clusterCandidates(props);
    case "task":
      return taskCandidates(props);
    default:
      return [];
  }
}
