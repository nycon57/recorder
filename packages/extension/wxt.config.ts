import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Tribora",
    description:
      "AI-powered knowledge assistant — context-aware guidance on any web app.",
    version: "0.0.1",
    permissions: ["activeTab", "storage", "tabs", "scripting", "tabCapture", "cookies"],
    host_permissions: ["<all_urls>"],
  },
});
