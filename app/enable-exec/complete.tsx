import type { CompleteProps } from "decopin-cli";
import {
  clusterCandidates,
  regionCandidates,
  serviceCandidates,
} from "../_lib/candidates.js";

export default function Complete(props: CompleteProps) {
  switch (props.name) {
    case "region":
      return regionCandidates();
    case "cluster":
      return clusterCandidates(props);
    case "service":
      return serviceCandidates(props);
    default:
      return [];
  }
}
