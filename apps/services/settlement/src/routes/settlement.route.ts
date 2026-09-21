import { API_PREFIX } from "@betng/contracts";
import { json } from "@betng/service-kit";
import type { HttpRouter } from "@betng/service-kit";
import type {
  CommissionController,
  OperatorController,
  SettlementController,
} from "../controllers/index.js";

export interface SettlementControllers {
  readonly settlement: SettlementController;
  readonly operator: OperatorController;
  readonly commission: CommissionController;
}

/** There is deliberately no route that edits a settlement, a ledger row or a result. */
export function registerSettlementRoutes(router: HttpRouter, controllers: SettlementControllers): void {
  const { settlement, operator, commission } = controllers;

  router.get(`${API_PREFIX}/settlements`, json(settlement.listSettlements));
  router.get(`${API_PREFIX}/settlements/:betId`, json(settlement.getSettlement));

  router.get(`${API_PREFIX}/admin/settlements`, json(settlement.listAdminSettlements));
  router.post(`${API_PREFIX}/admin/settlements/:id/retry`, json(settlement.retrySettlement));

  router.get(`${API_PREFIX}/admin/operator`, json(operator.getOverview));
  router.get(`${API_PREFIX}/admin/operator/periods`, json(operator.listPeriods));
  router.post(`${API_PREFIX}/admin/operator/periods/close`, json(operator.closePeriod));

  router.get(`${API_PREFIX}/admin/commission`, json(commission.listCommission));
  router.get(`${API_PREFIX}/admin/commission/config`, json(commission.getConfig));
  router.put(`${API_PREFIX}/admin/commission/config`, json(commission.updateConfig));

  router.post("/internal/settlement/matches/:id/settle", json(settlement.settleMatchInternally));
}
