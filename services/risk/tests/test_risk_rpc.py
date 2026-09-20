from __future__ import annotations

from typing import Any

from betng_service_kit import ServiceSettings
from fastapi.testclient import TestClient

from betng_risk.app import create_app
from betng_risk.configs import SERVICE_NAME, SERVICE_VERSION

EXPOSURE = {
    "matchId": "44444444-4444-4444-8444-444444444444",
    "marketId": "66666666-6666-4666-8666-666666666666",
    "selections": [
        {
            "selectionId": "77777777-7777-4777-8777-777777777777",
            "stake": 250000,
            "liability": 625000,
        }
    ],
    "currency": "NGN",
}


def build_client() -> TestClient:
    settings = ServiceSettings(
        service_name=SERVICE_NAME, version=SERVICE_VERSION, NODE_ENV="test"
    )
    return TestClient(create_app(settings), raise_server_exceptions=False)


def rpc(procedure: str, payload: Any) -> dict[str, Any]:
    frame = {
        "id": "rpc-test-1",
        "procedure": procedure,
        "payload": payload,
        "metadata": {"requestId": "trace-risk-rpc-0001"},
        "timestamp": 0,
    }
    response = build_client().post("/rpc", json=frame)
    assert response.status_code == 200
    return dict(response.json())


class TestCalculateExposure:
    def test_refuses_with_a_typed_code_until_the_model_is_built(self) -> None:
        body = rpc("risk.calculateExposure", EXPOSURE)

        # An invented ACCEPT would be the most dangerous placeholder here: it
        # would tell betting a market is within limits when nothing assessed
        # it. The refusal keeps its own code across the wire.
        assert body["success"] is False
        assert body["error"]["code"] == "NOT_IMPLEMENTED"

    def test_rejects_a_payload_with_no_selections(self) -> None:
        body = rpc("risk.calculateExposure", {**EXPOSURE, "selections": []})

        assert body["success"] is False
        assert body["error"]["code"] == "RPC_VALIDATION_ERROR"

    def test_rejects_a_negative_stake(self) -> None:
        body = rpc(
            "risk.calculateExposure",
            {
                **EXPOSURE,
                "selections": [
                    {
                        "selectionId": "77777777-7777-4777-8777-777777777777",
                        "stake": -1,
                        "liability": 0,
                    }
                ],
            },
        )

        assert body["success"] is False
        assert body["error"]["code"] == "RPC_VALIDATION_ERROR"


class TestCalculateLiability:
    def test_is_registered_as_its_own_procedure(self) -> None:
        body = rpc("risk.calculateLiability", EXPOSURE)

        # Registered and reachable — it refuses for the same reason exposure
        # does, not because the procedure is missing.
        assert body["error"]["code"] == "NOT_IMPLEMENTED"


class TestNoCommandSide:
    def test_risk_exposes_no_procedure_that_changes_anything(self) -> None:
        for procedure in (
            "risk.suspendMarket",
            "risk.adjustOdds",
            "risk.voidBet",
        ):
            body = rpc(procedure, EXPOSURE)

            # Risk reports; it never acts. Nothing it exposes can alter a
            # bet, a price or a result.
            assert body["error"]["code"] == "RPC_PROCEDURE_NOT_FOUND"
