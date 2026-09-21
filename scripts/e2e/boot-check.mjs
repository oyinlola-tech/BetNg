import { resetDatabase, startStack, url } from "./stack.mjs";

resetDatabase();
const stack = await startStack();
console.log("stack ready; gateway at", url("gateway"));
await new Promise((r) => setTimeout(r, Number(process.env.HOLD_MS ?? 3000)));
await stack.stop();
