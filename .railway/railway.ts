import { defineRailway, github, preserve, project, service } from "railway/iac";

export default defineRailway(() => {
  const ScamGuardMain = service("Scam-guard-Main", {
    source: github("Web-pixel-creator/Scam-guard-Main", { checkSuites: true }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
      watchPatterns: ["**", "!/*.md", "!/ai_docs/**"],
    },
    deploy: {
      healthcheckPath: "/healthz",
      healthcheckTimeout: 100,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
    replicas: { "us-west2": 1 },
    networking: { privateNetworkEndpoint: "scam-guard-main" },
    env: { GEMINI_TTS_API_KEY: preserve(), HASH_PEPPER_ACTIVE_SECRET: preserve(), HASH_PEPPER_ACTIVE_VERSION: preserve(), HASH_PEPPER_SECRET: preserve(), MONITOR_ALERT_CHAT_ID: preserve(), OPENAI_API_KEY: preserve(), OPENAI_BASE_URL: preserve(), OPENAI_MODEL: preserve(), OPENAI_TTS_API_KEY: preserve(), REQUIRE_ADMIN_MFA_AAL2: preserve(), SUPABASE_PUBLISHABLE_KEY: preserve(), SUPABASE_SERVICE_ROLE_KEY: preserve(), SUPABASE_URL: preserve(), TELEGRAM_BOT_TOKEN: preserve(), TELEGRAM_MODERATION_CHAT_ID: preserve(), TELEGRAM_QA_CHAT_ID: preserve(), TELEGRAM_UPDATE_DELIVERY_MODE: preserve(), TELEGRAM_WEBHOOK_SECRET: preserve(), VITE_SUPABASE_PROJECT_ID: preserve(), VITE_SUPABASE_PUBLISHABLE_KEY: preserve(), VITE_SUPABASE_URL: preserve() },
  });

  return project("elegant-cat", {
    resources: [ScamGuardMain],
  });
});
