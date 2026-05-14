/**
 * Logging utility for PolyLab
 * 
 * Provides structured logging with levels and prefixes.
 * Logs are always enabled in development for debugging.
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

interface LogEntry {
    level: LogLevel;
    module: string;
    message: string;
    data?: unknown;
    timestamp: Date;
}

class Logger {
    private level: LogLevel = LogLevel.DEBUG;
    private history: LogEntry[] = [];
    private maxHistorySize = 100;

    /**
     * Set the minimum log level
     */
    setLevel(level: LogLevel): void {
        this.level = level;
    }

    /**
     * Get log history
     */
    getHistory(): LogEntry[] {
        return [...this.history];
    }

    /**
     * Clear log history
     */
    clearHistory(): void {
        this.history = [];
    }

    /**
     * Log a debug message
     */
    debug(module: string, message: string, data?: unknown): void {
        this.log(LogLevel.DEBUG, module, message, data);
    }

    /**
     * Log an info message
     */
    info(module: string, message: string, data?: unknown): void {
        this.log(LogLevel.INFO, module, message, data);
    }

    /**
     * Log a warning message
     */
    warn(module: string, message: string, data?: unknown): void {
        this.log(LogLevel.WARN, module, message, data);
    }

    /**
     * Log an error message
     */
    error(module: string, message: string, data?: unknown): void {
        this.log(LogLevel.ERROR, module, message, data);
    }

    private log(level: LogLevel, module: string, message: string, data?: unknown): void {
        if (level < this.level) {
            return;
        }

        const entry: LogEntry = {
            level,
            module,
            message,
            data,
            timestamp: new Date(),
        };

        // Add to history
        this.history.push(entry);
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }

        // Format message
        const timestamp = entry.timestamp.toLocaleTimeString('fr-FR');
        const levelStr = LogLevel[level].padEnd(5);
        const prefix = `[${timestamp}] [${levelStr}] [${module}]`;
        const fullMessage = `${prefix} ${message}`;

        // Log to console
        switch (level) {
            case LogLevel.DEBUG:
                if (data !== undefined) {
                    console.debug(fullMessage, data);
                } else {
                    console.debug(fullMessage);
                }
                break;
            case LogLevel.INFO:
                if (data !== undefined) {
                    console.info(fullMessage, data);
                } else {
                    console.info(fullMessage);
                }
                break;
            case LogLevel.WARN:
                if (data !== undefined) {
                    console.warn(fullMessage, data);
                } else {
                    console.warn(fullMessage);
                }
                break;
            case LogLevel.ERROR:
                if (data !== undefined) {
                    console.error(fullMessage, data);
                } else {
                    console.error(fullMessage);
                }
                break;
        }
    }
}

// Global logger instance
export const logger = new Logger();

// Convenience functions for common modules
export const appLogger = {
    debug: (msg: string, data?: unknown) => logger.debug('App', msg, data),
    info: (msg: string, data?: unknown) => logger.info('App', msg, data),
    warn: (msg: string, data?: unknown) => logger.warn('App', msg, data),
    error: (msg: string, data?: unknown) => logger.error('App', msg, data),
};

export const viewerLogger = {
    debug: (msg: string, data?: unknown) => logger.debug('Viewer', msg, data),
    info: (msg: string, data?: unknown) => logger.info('Viewer', msg, data),
    warn: (msg: string, data?: unknown) => logger.warn('Viewer', msg, data),
    error: (msg: string, data?: unknown) => logger.error('Viewer', msg, data),
};

export const meshLogger = {
    debug: (msg: string, data?: unknown) => logger.debug('Mesh', msg, data),
    info: (msg: string, data?: unknown) => logger.info('Mesh', msg, data),
    warn: (msg: string, data?: unknown) => logger.warn('Mesh', msg, data),
    error: (msg: string, data?: unknown) => logger.error('Mesh', msg, data),
};

export const uiLogger = {
    debug: (msg: string, data?: unknown) => logger.debug('UI', msg, data),
    info: (msg: string, data?: unknown) => logger.info('UI', msg, data),
    warn: (msg: string, data?: unknown) => logger.warn('UI', msg, data),
    error: (msg: string, data?: unknown) => logger.error('UI', msg, data),
};
