import { integer, maxValue, minLength, minValue, object, optional, pipe, regex, string, transform, } from "valibot";
export const ConnectOptionsSchema = object({
    region: optional(pipe(string(), minLength(1, "Region cannot be empty"))),
    cluster: optional(pipe(string(), minLength(1, "Cluster name cannot be empty"))),
    task: optional(pipe(string(), minLength(1, "Task ID cannot be empty"))),
    rds: optional(pipe(string(), minLength(1, "RDS instance identifier cannot be empty"))),
    rdsPort: optional(pipe(string(), minLength(1, "RDS port cannot be empty"), regex(/^\d+$/, "RDS port must be a number"), transform(Number), integer("RDS port must be an integer"), minValue(1, "RDS port must be greater than 0"), maxValue(65535, "RDS port must be less than 65536"))),
    localPort: optional(pipe(string(), minLength(1, "Local port cannot be empty"), regex(/^\d+$/, "Local port must be a number"), transform(Number), integer("Local port must be an integer"), minValue(1, "Local port must be greater than 0"), maxValue(65535, "Local port must be less than 65536"))),
});
