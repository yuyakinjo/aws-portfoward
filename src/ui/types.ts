export interface SelectionState {
  region?: string;
  rds?: string;
  rdsPort?: string;
  ecsTarget?: string;
  ecsCluster?: string;
  localPort?: string;
}

export interface StepInfo {
  id: string;
  title: string;
  completed: boolean;
  current: boolean;
}

export interface AsyncState<T> {
  data?: T;
  loading: boolean;
  error?: Error;
}

export interface SearchableItem {
  id: string;
  label: string;
  description?: string;
  value: any;
}

export type LoadingState = "idle" | "loading" | "success" | "error";
