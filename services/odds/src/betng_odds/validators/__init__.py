"""Request schemas.

FastAPI validates each REST body against the Pydantic model in ``dtos``, and
the RPC server validates each payload against the same model, so the contract
shapes are the validators for both doors.
"""
