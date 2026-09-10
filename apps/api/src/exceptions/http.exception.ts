export class HttpException extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function requireThat(condition: unknown, status: number, code: string, message: string): asserts condition {
  if (!condition) throw new HttpException(status, code, message);
}
