import { connection } from "next/server";
import { backendBaseUrl } from "@/lib/backend";

/**
 * Placeholder home page for the initial setup: confirms the frontend can reach
 * the backend. Replaced by the posts dashboard once the CRM screens land.
 */
async function backendStatus(): Promise<"up" | "down"> {
  try {
    const res = await fetch(`${backendBaseUrl()}/health/readiness`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok ? "up" : "down";
  } catch {
    return "down";
  }
}

export default async function HomePage() {
  // Render per request so BACKEND_API_URL is read at runtime, not baked in at build.
  await connection();
  const status = await backendStatus();

  return (
    <main className="mx-auto flex w-full max-w-[var(--container-max)] flex-1 flex-col justify-center gap-4 px-[var(--container-padding)]">
      <h1 className="text-3xl font-semibold">Blog CRM</h1>
      <p className="text-[var(--text-secondary)]">
        Backend:{" "}
        <span
          className={
            status === "up"
              ? "font-mono text-[var(--status-success)]"
              : "font-mono text-[var(--status-danger)]"
          }
        >
          {status}
        </span>
      </p>
    </main>
  );
}
