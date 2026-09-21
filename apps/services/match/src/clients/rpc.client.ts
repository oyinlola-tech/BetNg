/**
 * Shared plumbing of the match service's RPC clients.
 *
 * A peer's answer is validated like any other input: the lifecycle advances on what a peer said, so a malformed
 * answer is a failed call, not a transition.
 */

import { createRPCMetadata } from "@zudojs/rpc";
import type { RPCClient } from "@zudojs/rpc";
import { validate } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";

export async function callValidated<TInput, TOutput>(
  client: RPCClient,
  procedure: string,
  input: TInput,
  requestId: string,
  schema: ValidationSchema<TOutput>,
): Promise<TOutput> {
  const answer = await client.call<TInput, unknown>(procedure, input, {
    metadata: createRPCMetadata({ requestId }),
  });

  const result = validate(schema, answer);

  if (!result.success) {
    throw new Error(`${procedure} answered with an unexpected shape.`);
  }

  return result.data;
}
