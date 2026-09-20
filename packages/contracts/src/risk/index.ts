/**
 * @betng/contracts/risk
 *
 * The wire format of the Python risk service: exposure in, an action out.
 */

export {
  exposureReportSchema,
  exposureRequestSchema,
  riskActionSchema,
  selectionExposureSchema,
} from "./exposure.type.js";
export type {
  ExposureReport,
  ExposureRequest,
  RiskAction,
  SelectionExposure,
} from "./exposure.type.js";
