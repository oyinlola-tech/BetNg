from __future__ import annotations

TABLES: dict[str, str] = {
    "match.leagues": """
        id uuid PRIMARY KEY, name text NOT NULL, code text NOT NULL,
        slug text NOT NULL, country text NOT NULL, sport text NOT NULL,
        status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
    """,
    "match.teams": """
        id uuid PRIMARY KEY, league_id uuid NOT NULL, name text NOT NULL,
        short_name text NOT NULL, code text NOT NULL, city text, stadium text,
        color_primary text, color_secondary text, strength int, attack int,
        defence int, midfield int, goalkeeping int, pace int, finishing int,
        possession int, form int, home_advantage int,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    """,
    "match.fixtures": """
        id uuid PRIMARY KEY, league_id uuid NOT NULL, season int NOT NULL,
        matchday int NOT NULL, home_team_id uuid NOT NULL,
        away_team_id uuid NOT NULL, kickoff_at timestamptz NOT NULL,
        betting_closes_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    """,
    "match.matches": """
        id uuid PRIMARY KEY, fixture_id uuid NOT NULL UNIQUE, status text NOT NULL,
        lifecycle text NOT NULL, home_score int, away_score int,
        revealed_sequence int NOT NULL DEFAULT 0, completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    """,
    "simulation.match_results": """
        match_id uuid PRIMARY KEY, simulation_id uuid NOT NULL,
        home_goals int NOT NULL, away_goals int NOT NULL, winner text NOT NULL,
        winning_gap int NOT NULL, home_xg numeric(6,3), away_xg numeric(6,3),
        seed text NOT NULL, model_version text NOT NULL,
        configuration_version int NOT NULL, stats jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
    """,
    "betting.bets": """
        id uuid PRIMARY KEY, user_id uuid, channel text NOT NULL, shop_id uuid,
        cashier_id uuid, stake bigint NOT NULL, currency text NOT NULL,
        total_odds numeric(12,2) NOT NULL, potential_payout bigint NOT NULL,
        status text NOT NULL, payout bigint, risk_decision_id uuid,
        idempotency_key text NOT NULL, placed_at timestamptz NOT NULL,
        settled_at timestamptz, cancelled_at timestamptz
    """,
    "betting.bet_selections": """
        id uuid PRIMARY KEY, bet_id uuid NOT NULL, match_id uuid NOT NULL,
        market_id uuid NOT NULL, selection_id uuid NOT NULL,
        league_id uuid NOT NULL, market_type text NOT NULL,
        selection_code text NOT NULL, line numeric(4,1),
        odds numeric(8,2) NOT NULL, odds_version int NOT NULL,
        market_label text NOT NULL, selection_label text NOT NULL,
        match_label text NOT NULL, league_name text NOT NULL,
        kickoff_at timestamptz NOT NULL, outcome text NOT NULL, result text
    """,
    "betting.tickets": """
        id uuid PRIMARY KEY, bet_id uuid NOT NULL UNIQUE, code text NOT NULL UNIQUE,
        shop_id uuid NOT NULL, shop_code text NOT NULL, cashier_id uuid NOT NULL,
        cashier_name text NOT NULL, customer_name text, customer_phone text,
        status text NOT NULL, paid_at timestamptz, paid_by uuid,
        expires_at timestamptz NOT NULL, cancel_reason text,
        created_at timestamptz NOT NULL
    """,
    "wallet.wallet_accounts": """
        id uuid PRIMARY KEY, owner_type text NOT NULL, owner_id uuid NOT NULL,
        balance bigint NOT NULL, reserved bigint NOT NULL DEFAULT 0,
        currency text NOT NULL, version int NOT NULL DEFAULT 0,
        frozen_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (owner_type, owner_id)
    """,
    "wallet.wallet_transactions": """
        id uuid PRIMARY KEY, account_id uuid NOT NULL, type text NOT NULL,
        amount bigint NOT NULL, currency text NOT NULL,
        balance_after bigint NOT NULL, idempotency_key text NOT NULL,
        reference text, note text, actor_id text, corrects_id uuid,
        created_at timestamptz NOT NULL
    """,
    "settlement.settlements": """
        id uuid PRIMARY KEY, bet_id uuid NOT NULL, revision int NOT NULL,
        outcome text NOT NULL, stake bigint NOT NULL, payout bigint NOT NULL,
        channel text NOT NULL, user_id uuid, shop_id uuid, cashier_id uuid,
        period_id text NOT NULL, effects_applied_at timestamptz,
        settled_at timestamptz NOT NULL, UNIQUE (bet_id, revision)
    """,
    "settlement.operator_ledger_entries": """
        id uuid PRIMARY KEY, settlement_id uuid NOT NULL UNIQUE,
        period_id text NOT NULL, bet_id uuid NOT NULL, channel text NOT NULL,
        user_id uuid, shop_id uuid, cashier_id uuid, outcome text NOT NULL,
        stake bigint NOT NULL, payout bigint NOT NULL,
        created_at timestamptz NOT NULL
    """,
    "settlement.commission_ledger": """
        id uuid PRIMARY KEY, period_id text NOT NULL, shop_id uuid NOT NULL,
        gross_stakes bigint NOT NULL, gross_payouts bigint NOT NULL,
        gross_operator_result bigint NOT NULL,
        shop_share_percent numeric(5,2) NOT NULL,
        shop_share_amount bigint NOT NULL,
        platform_share_percent numeric(5,2) NOT NULL,
        platform_share_amount bigint NOT NULL, created_at timestamptz NOT NULL,
        UNIQUE (period_id, shop_id)
    """,
    "risk.risk_decisions": """
        id uuid PRIMARY KEY, request_id text NOT NULL, actor_kind text NOT NULL,
        actor_id uuid NOT NULL, shop_id uuid, stake_requested bigint NOT NULL,
        total_odds numeric(12,2) NOT NULL, decision text NOT NULL,
        reason text NOT NULL, max_stake bigint NOT NULL, legs jsonb NOT NULL,
        limits_version int NOT NULL, created_at timestamptz NOT NULL
    """,
    "identity.customers": """
        id uuid PRIMARY KEY, email text NOT NULL, display_name text NOT NULL,
        phone text, status text NOT NULL, email_verified_at timestamptz,
        last_active_at timestamptz NOT NULL, created_at timestamptz NOT NULL
            DEFAULT now()
    """,
    "identity.shops": """
        id uuid PRIMARY KEY, code text NOT NULL, name text NOT NULL,
        address text NOT NULL, phone text NOT NULL, email text NOT NULL,
        status text NOT NULL, owner_name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    """,
    "identity.cashiers": """
        id uuid PRIMARY KEY, shop_id uuid NOT NULL, username text NOT NULL,
        display_name text NOT NULL, role text NOT NULL, status text NOT NULL,
        last_active_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
    """,
    "identity.audit_logs": """
        id uuid PRIMARY KEY, actor_id varchar(80) NOT NULL,
        actor_role varchar(40) NOT NULL, actor_name varchar(80) NOT NULL,
        action varchar(80) NOT NULL, entity_type varchar(80) NOT NULL,
        entity_id varchar(80) NOT NULL, before jsonb, after jsonb,
        reason varchar(240), severity text NOT NULL,
        request_id varchar(64) NOT NULL, created_at timestamptz NOT NULL
    """,
}
