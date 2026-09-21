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
