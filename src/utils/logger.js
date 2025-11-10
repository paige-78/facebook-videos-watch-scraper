import winston from 'winston';

export function createLogger(label = 'app', level = process.env.LOG_LEVEL || 'info') {
const logger = winston.createLogger({
level,
format: winston.format.combine(
winston.format.timestamp(),
winston.format.label({ label }),
winston.format.printf(({ timestamp, level, message, label }) => {
return `${timestamp} [${label}] ${level.toUpperCase()}: ${message}`;
})
),
transports: [new winston.transports.Console()]
});
// Convenience methods
logger.debug = logger.debug.bind(logger);
logger.info = logger.info.bind(logger);
logger.warn = logger.warn.bind(logger);
logger.error = logger.error.bind(logger);
return logger;
}