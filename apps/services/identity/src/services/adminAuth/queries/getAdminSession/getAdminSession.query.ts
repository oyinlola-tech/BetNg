import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";

export class GetAdminSessionQuery extends Query<"identity.getAdminSession"> {
  public readonly token: string | undefined;

  public constructor(token: string | undefined) {
    super(IDENTITY_QUERY.GET_ADMIN_SESSION);
    this.token = token;
  }
}
