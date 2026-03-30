import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL || "https://notable-tern-4.convex.cloud";

export const convex = new ConvexReactClient(convexUrl);
