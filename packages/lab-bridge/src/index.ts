import "dotenv/config";
import { HubOrchestrator } from "./HubOrchestrator.js";

async function main(): Promise<void> {
  const hub = new HubOrchestrator();

  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    process.exit(0);
  });
  process.on("SIGTERM", () => process.exit(0));

  await hub.start();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
