import { z } from "zod";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
export type Project = FunctionReturnType<
  typeof api.projects.adminList
>["page"][number];
export const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Proje adını girin.")
    .max(100, "Proje adı en fazla 100 karakter olabilir."),
  description: z.string(),
  isActive: z.boolean(),
});
export type ProjectForm = z.infer<typeof projectSchema>;
