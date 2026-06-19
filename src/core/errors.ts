/** Printing-Press-standard exit codes (shared by CLI + core). */
export const EXIT = {
  OK: 0,
  USAGE: 2,
  NOT_FOUND: 3,
  AUTH: 4,
  API: 5,
  RATE_LIMITED: 7,
  CONFIG: 10,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/** Carries an exit code through a throw so the top-level handler can map it. */
export class CliError extends Error {
  code: ExitCode;
  constructor(message: string, code: ExitCode) {
    super(message);
    this.name = "CliError";
    this.code = code;
  }
}
