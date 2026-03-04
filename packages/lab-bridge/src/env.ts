import "dotenv/config";

export const BOT_DID = process.env["BOT_DID"] as string;
export const BOT_APP_PASSWORD = process.env["BOT_APP_PASSWORD"] as string;

if (!BOT_DID || !BOT_APP_PASSWORD) {
  throw new Error("BOT_DID and BOT_APP_PASSWORD environment variables required.");
}

export const LEAF_URL = process.env["LEAF_URL"] ?? "https://leaf-dev.muni.town";
export const LEAF_SERVER_DID =
  process.env["LEAF_SERVER_DID"] ?? `did:web:${new URL(LEAF_URL).hostname}`;

export const STREAM_NSID =
  process.env["STREAM_NSID"] ?? "space.roomy.space.personal.dev";
export const STREAM_HANDLE_NSID =
  process.env["STREAM_HANDLE_NSID"] ?? "space.roomy.space.handle.dev";

export const PORT = parseInt(process.env["PORT"] ?? "3401");
