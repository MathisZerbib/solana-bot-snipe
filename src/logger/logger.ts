import winston from "winston";
import { CONFIG } from "../config/config";

// Assuming CONFIG is properly typed in your config file. If not, you might want to add an interface for it.
interface LoggerConfig {
  logFile: string;
}

// Type assertion for CONFIG if you're sure it has the correct shape
const loggerConfig = CONFIG as LoggerConfig;

export const logger: winston.Logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: loggerConfig.logFile }),
  ],
});