import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Tests run inside the Workers runtime (workerd) against a real local D1.
export default defineConfig(async () => {
  const migrations = await readD1Migrations("migrations");
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            APP_SECRET: "test-app-secret",
            VERIFY_TOKEN: "test-verify-token",
            WHATSAPP_TOKEN: "test-token",
            DRY_RUN: "false",
            OWNER_PHONE: "919000000001",
            BOT_NUMBER: "919000000000",
            PHONE_NUMBER_ID: "1234567890",
            GRAPH_API_VERSION: "v24.0",
            MAIL_RELAY_URL: "",
            MAIL_RELAY_KEY: "",
            SETUP_KEY: "test-setup-key",
          },
        },
      }),
    ],
    test: { include: ["test/**/*.test.ts"], setupFiles: ["./test/setup.ts"] },
  };
});
