import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Smart e-Prescription — Digital Prescription Pad" },
      {
        name: "description",
        content: "Create, preview and share digital prescriptions from your clinic in seconds.",
      },
      { property: "og:title", content: "Smart e-Prescription — Digital Prescription Pad" },
      {
        property: "og:description",
        content: "Create, preview and share digital prescriptions from your clinic in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
