import { isDefined } from "remeda";

export const isUndefined = <T>(value: T | undefined): value is undefined =>
  !isDefined(value);
