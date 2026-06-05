import fs from 'fs';
import path from 'path';
import { env } from '@config/env';

/**
 * Niveaux de log
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger simple mais efficace
 * Écrit sur stdout, stderr et dans des fichiers
 */
class Logger {
  private logDir: string;
  private currentLogLevel: LogLevel;
  private levelValues: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    this.logDir = env.LOG_DIR;
    this.currentLogLevel = (env.LOG_LEVEL as LogLevel) || 'info';
    this.ensureLogDir();
  }

  /**
   * S'assure que le répertoire des logs existe
   */
  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Format la date/heure
   */
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Récupère le chemin du fichier log
   */
  private getLogFilePath(level: LogLevel): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${level}-${date}.log`);
  }

  /**
   * Écrit dans le fichier log
   */
  private writeToFile(level: LogLevel, message: string, data?: unknown): void {
    const logEntry = `[${this.formatTimestamp()}] [${level.toUpperCase()}] ${message}`;
    const fullMessage = data ? `${logEntry}\n${JSON.stringify(data, null, 2)}` : logEntry;
    
    try {
      fs.appendFileSync(this.getLogFilePath(level), `${fullMessage}\n`);
    } catch (error) {
      console.error('Erreur lors de l\'écriture du log:', error);
    }
  }

  /**
   * Format le message de console
   */
  private formatConsole(level: LogLevel, message: string, data?: unknown): string {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Vert
      warn: '\x1b[33m',  // Jaune
      error: '\x1b[31m', // Rouge
      reset: '\x1b[0m',
    };
    
    const timestamp = this.formatTimestamp();
    const prefix = `${colors[level]}[${timestamp}] [${level.toUpperCase()}]${colors.reset}`;
    const fullMessage = data ? `${prefix} ${message}\n${JSON.stringify(data, null, 2)}` : `${prefix} ${message}`;
    
    return fullMessage;
  }

  /**
   * Log de niveau DEBUG
   */
  debug(message: string, data?: unknown): void {
    if (this.levelValues.debug >= this.levelValues[this.currentLogLevel]) {
      console.log(this.formatConsole('debug', message, data));
      this.writeToFile('debug', message, data);
    }
  }

  /**
   * Log de niveau INFO
   */
  info(message: string, data?: unknown): void {
    if (this.levelValues.info >= this.levelValues[this.currentLogLevel]) {
      console.log(this.formatConsole('info', message, data));
      this.writeToFile('info', message, data);
    }
  }

  /**
   * Log de niveau WARN
   */
  warn(message: string, data?: unknown): void {
    if (this.levelValues.warn >= this.levelValues[this.currentLogLevel]) {
      console.warn(this.formatConsole('warn', message, data));
      this.writeToFile('warn', message, data);
    }
  }

  /**
   * Log de niveau ERROR
   */
  error(message: string, data?: unknown | Error): void {
    if (this.levelValues.error >= this.levelValues[this.currentLogLevel]) {
      const errorData = data instanceof Error ? { message: data.message, stack: data.stack } : data;
      console.error(this.formatConsole('error', message, errorData));
      this.writeToFile('error', message, errorData);
    }
  }
}

export const logger = new Logger();
