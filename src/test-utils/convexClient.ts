import type { ConvexReactClient } from "convex/react";
import { getFunctionName, makeFunctionReference, type FunctionArgs, type FunctionReference,
  type FunctionReference_future, type FunctionReturnType, type OptionalRestArgs } from "convex/server";
import type { TestConvex } from "convex-test";
import type schema from "../../convex/schema";

/** convex-test still accepts legacy references; React clients also accept future references.
 * Normalize the reference by name while retaining its argument and return types. */
export function convexTestClient(client: Pick<TestConvex<typeof schema>, "query">): Pick<ConvexReactClient, "query"> {
  return {
    query<Q extends FunctionReference<"query"> | FunctionReference_future<"query">>(reference: Q, ...args: OptionalRestArgs<Q>): Promise<FunctionReturnType<Q>> {
      const legacy = makeFunctionReference<"query", FunctionArgs<Q>, FunctionReturnType<Q>>(getFunctionName(reference));
      return client.query(legacy, ...args);
    },
  };
}
