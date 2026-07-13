import pino from "pino";
import type { Config } from "../config/env.js";

export function buildLoggerOptions(config: Pick<Config, "LOG_LEVEL">) {
  return {
    level: config.LOG_LEVEL,
  } satisfies pino.LoggerOptions;
}
