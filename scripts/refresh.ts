import { refreshProvider, refreshWiredProviders } from "../lib/store/refresh";

const providerId = process.argv[2] ?? "all";

async function main() {
  if (providerId === "all") {
    const state = await refreshWiredProviders();
    console.log(
      JSON.stringify(
        state.providers.map((record) => ({
          id: record.id,
          status: record.status,
          boardRate: record.snapshot?.boardRate ?? null,
          asOf: record.snapshot?.asOf ?? null,
          error: record.error,
        })),
        null,
        2,
      ),
    );
    return;
  }

  const record = await refreshProvider(providerId);
  console.log(
    JSON.stringify(
      {
        id: record.id,
        status: record.status,
        boardRate: record.snapshot?.boardRate ?? null,
        asOf: record.snapshot?.asOf ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
