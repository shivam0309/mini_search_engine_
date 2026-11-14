import pytest

from app.sample_data import load_sample
from evaluation.metrics import compare, precision_at_k, reciprocal_rank


def test_precision_at_10():
    ranked = ["a", "x", "b", "y"]
    assert precision_at_k(ranked, {"a", "b", "c"}) == pytest.approx(0.2)


def test_reciprocal_rank():
    assert reciprocal_rank(["x", "a"], {"a"}) == 0.5
    assert reciprocal_rank(["x"], {"a"}) == 0


def test_sample_evaluation_matches_the_front_end(db):
    load_sample(db)
    result = compare(db)
    assert result["blended"]["mrr"] == pytest.approx(1.0)
    assert result["blended"]["meanPrecisionAt10"] == pytest.approx(0.33)
    assert result["bm25Only"]["meanPrecisionAt10"] == pytest.approx(0.34)
    assert len(result["blended"]["rows"]) == 10
