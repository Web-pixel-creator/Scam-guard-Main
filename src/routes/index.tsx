import { createFileRoute } from "@tanstack/react-router";

import { ViperHome } from "@/components/home/ViperHome";

export const Route = createFileRoute("/")({
  component: ViperHome,
});
