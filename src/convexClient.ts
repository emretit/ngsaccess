import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) throw new Error("VITE_CONVEX_URL gerekli");

export const convex = new ConvexReactClient(convexUrl);
