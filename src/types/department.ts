import type { Id } from "../../convex/_generated/dataModel";

export interface Department {
  _id: Id<"departments">;
  name: string;
  parentId?: Id<"departments"> | null;
  level?: number;
  projectId?: Id<"projects">;
  createdAt?: string;
  updatedAt?: string;
}
