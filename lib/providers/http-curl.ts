import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseIncludedHttpResponse } from "./http";

const execFileAsync = promisify(execFile);

export async function curlGetHtml(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ status: number; html: string; cookies: string } | null> {
  const args = [
    "-sS",
    "-L",
    "-i",
    "--compressed",
    "--max-time",
    String(Math.max(1, Math.ceil(timeoutMs / 1000))),
  ];
  for (const [key, value] of Object.entries(headers)) {
    args.push("-H", `${key}: ${value}`);
  }
  args.push(url);

  try {
    const { stdout } = await execFileAsync("curl", args, {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    return parseIncludedHttpResponse(stdout);
  } catch (error) {
    const stdout =
      error && typeof error === "object" && "stdout" in error
        ? String(error.stdout ?? "")
        : "";
    return stdout ? parseIncludedHttpResponse(stdout) : null;
  }
}
