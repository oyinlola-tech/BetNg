import { randomInt } from "node:crypto";
import { TICKET } from "../constants/index.js";

/** A ticket code from a CSPRNG: a code is a bearer claim on a payout. */
export function generateTicketCode(): string {
  let code = "";

  for (let index = 0; index < TICKET.codeLength; index += 1) {
    code += TICKET.alphabet.charAt(randomInt(TICKET.alphabet.length));
  }

  return code;
}
