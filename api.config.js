import { defineConfig } from "cypress";
import dotenv from "dotenv";
dotenv.config();

const ENV_URLS = {
  dev: process.env.DEV_BASE_URL,
  qa: process.env.QA_BASE_URL,
  prod: process.env.PROD_BASE_URL,
};

const email = process.env.EMAIL || "";
const password = process.env.PASSWORD || "";

function resolveTargetEnv(config) {
  const rawEnv = config.env?.env || process.env.env || process.env.TARGET_ENV || "qa";
  const normalizedEnv = String(rawEnv).trim().toLowerCase();
  return ENV_URLS[normalizedEnv] ? normalizedEnv : "qa";
}

export default defineConfig({
  reporter: 'mochawesome',

  reporterOptions: {
    reportDir: 'cypress/reports/api',
    overwrite: false,
    html: true,
    json: true,
  },

  e2e: {
    specPattern: 'cypress/e2e/api/**/*.cy.js',

    env: {
      EMAIL: email,
      PASSWORD: password
    },

    setupNodeEvents(on, config) {
      if (!config.env.EMAIL || !config.env.PASSWORD) {
        throw new Error("Missing EMAIL or PASSWORD in environment. Add them to your .env file.");
      }

      const targetEnv = resolveTargetEnv(config);
      if (!ENV_URLS[targetEnv]) {
        throw new Error(`Missing base URL for '${targetEnv}'. Set ${targetEnv.toUpperCase()}_BASE_URL in your environment or GitHub Actions variable.`);
      }

      config.baseUrl = ENV_URLS[targetEnv];
      config.env.env = targetEnv;

      // Makes selected environment visible in CI logs.
      console.log(`Running API tests against ${targetEnv.toUpperCase()} (${config.baseUrl})`);
      return config;
    },
  },
});