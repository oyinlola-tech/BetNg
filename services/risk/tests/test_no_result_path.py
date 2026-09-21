from __future__ import annotations

import re
from pathlib import Path

PACKAGE = Path(__file__).parent.parent / "src" / "betng_risk"
SOURCES = sorted([*PACKAGE.rglob("*.py"), *PACKAGE.rglob("*.sql")])

SIMULATION_IMPORT = re.compile(r"^\s*(from|import)\s+\S*simulation", re.MULTILINE)
SIMULATION_SCHEMA = re.compile(r"\bsimulation\.\w")
RESULT_TABLES = re.compile(r"match_results|match_events|simulation_runs")
RESULT_COLUMNS = re.compile(r"\b(home_score|away_score|home_goals|away_goals|winner)\b")


def test_the_package_has_sources_to_scan() -> None:
    assert len(SOURCES) > 30
    assert any(path.suffix == ".sql" for path in SOURCES)


def test_nothing_imports_the_simulation() -> None:
    offenders = [p.name for p in SOURCES if SIMULATION_IMPORT.search(p.read_text())]
    assert offenders == []


def test_no_sql_names_the_simulation_schema() -> None:
    offenders = [p.name for p in SOURCES if SIMULATION_SCHEMA.search(p.read_text())]
    assert offenders == []


def test_nothing_reads_a_result_table_or_a_score_column() -> None:
    offenders = [
        p.name
        for p in SOURCES
        if RESULT_TABLES.search(p.read_text()) or RESULT_COLUMNS.search(p.read_text())
    ]
    assert offenders == []


def test_there_is_no_client_for_the_simulation_service() -> None:
    offenders = [
        p.name for p in SOURCES if "simulation_service_url" in p.read_text().lower()
    ]
    assert offenders == []


def test_risk_writes_only_its_own_schema() -> None:
    write = re.compile(
        r"\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE)"
        r"\s+(?!risk\.)([a-z_]+\.[a-z_]+)",
        re.IGNORECASE,
    )
    offenders = [
        (p.name, match.group(2))
        for p in SOURCES
        for match in write.finditer(p.read_text())
    ]
    assert offenders == []
