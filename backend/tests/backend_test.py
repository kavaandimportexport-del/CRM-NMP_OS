"""NMP Sales OS Phase 2 - Backend API tests"""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pro-audio-crm.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@nmp.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 0
    assert "user" in data and data["user"]["email"] == ADMIN_EMAIL
    # cookie set
    assert "access_token" in r.cookies, f"access_token cookie not set; cookies={r.cookies}"
    return data["token"]


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


# ---------------- Auth ----------------
class TestAuth:
    def test_login_returns_token_and_cookie(self, token):
        assert isinstance(token, str)

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrongpass"})
        assert r.status_code == 401

    def test_me(self, client):
        r = client.get(f"{API}/auth/me")
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert d["role"] == "super_admin"


# ---------------- Dashboard KPIs ----------------
class TestDashboard:
    def test_kpis_contains_phase2_fields(self, client):
        r = client.get(f"{API}/dashboard/kpis")
        assert r.status_code == 200
        d = r.json()
        for key in [
            "pipeline_value", "today_follow_ups", "overdue_follow_ups",
            "conversion_rate", "status_breakdown", "source_breakdown",
            "total_leads", "open_leads", "deals_won", "deals_lost",
        ]:
            assert key in d, f"missing key {key} in dashboard kpis"
        assert isinstance(d["status_breakdown"], dict)
        assert isinstance(d["source_breakdown"], list)
        assert isinstance(d["pipeline_value"], (int, float))


# ---------------- Pipeline ----------------
class TestPipeline:
    def test_pipeline_has_7_stages(self, client):
        r = client.get(f"{API}/pipeline")
        assert r.status_code == 200
        d = r.json()
        expected = ["New", "Contacted", "Site Visit", "Quotation", "Negotiation", "Won", "Lost"]
        for s in expected:
            assert s in d, f"missing stage {s}"
            assert "count" in d[s] and "value" in d[s] and "leads" in d[s]
            assert isinstance(d[s]["leads"], list)
            assert isinstance(d[s]["count"], int)


# ---------------- Follow-ups ----------------
class TestFollowUps:
    def test_followups_structure(self, client):
        r = client.get(f"{API}/follow-ups")
        assert r.status_code == 200
        d = r.json()
        for k in ["today", "overdue", "upcoming"]:
            assert k in d
            assert isinstance(d[k], list)


# ---------------- Inventory ----------------
class TestInventory:
    def test_inventory_seeded(self, client):
        r = client.get(f"{API}/inventory")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 12, f"Expected at least 12 seeded products, got {len(items)}"

    def test_inventory_search_shure(self, client):
        r = client.get(f"{API}/inventory", params={"search": "shure"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 2, f"Expected at least 2 Shure products, got {len(items)}"
        for it in items:
            blob = f"{it.get('product_name','')} {it.get('brand','')} {it.get('sku','')}".lower()
            assert "shure" in blob


# ---------------- Leads (extended fields) ----------------
@pytest.fixture(scope="session")
def created_lead(client):
    payload = {
        "lead_name": "TEST_PhaseTwoLead",
        "company_name": "TEST_Co",
        "contact_person": "Tester",
        "mobile": "9999999999",
        "email": "test_phase2@example.com",
        "lead_source": "Website",
        "lead_type": "Product Sale",
        "expected_deal_value": 250000,
        "priority": "High",
        "status": "New",
        "decision_maker": "Mr. Decision",
        "budget": 300000,
        "next_follow_up": datetime.now(timezone.utc).date().isoformat(),
        "follow_up_type": "Call",
        "expected_closure_date": (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat(),
        "competitor": "Other Vendor",
        "probability": 60,
    }
    r = client.post(f"{API}/leads", json=payload)
    assert r.status_code == 200, f"Create lead failed: {r.status_code} {r.text}"
    return r.json()


class TestLeads:
    def test_create_lead_with_extended_fields(self, created_lead):
        for field in ["decision_maker", "budget", "next_follow_up", "follow_up_type",
                      "expected_closure_date", "competitor", "probability"]:
            assert field in created_lead, f"missing {field} in created lead"
        assert created_lead["decision_maker"] == "Mr. Decision"
        assert created_lead["budget"] == 300000
        assert created_lead["competitor"] == "Other Vendor"
        assert created_lead["probability"] == 60

    def test_lead_retrievable_with_persisted_fields(self, client, created_lead):
        r = client.get(f"{API}/leads/{created_lead['id']}")
        assert r.status_code == 200
        d = r.json()
        assert d["decision_maker"] == "Mr. Decision"
        assert d["follow_up_type"] == "Call"
        assert d["competitor"] == "Other Vendor"
        assert "health_score" in d and isinstance(d["health_score"], int)
        assert 0 <= d["health_score"] <= 100

    def test_lead_status_update_logs_activity(self, client, created_lead):
        lid = created_lead["id"]
        r = client.put(f"{API}/leads/{lid}", json={"status": "Contacted"})
        assert r.status_code == 200
        assert r.json()["status"] == "Contacted"
        r2 = client.get(f"{API}/leads/{lid}/activities")
        assert r2.status_code == 200
        acts = r2.json()
        assert any(a.get("activity_type") == "status_change" and "Contacted" in a.get("description", "")
                   for a in acts), f"Status change activity not logged: {acts}"

    def test_lead_health_score_increases_with_signals(self, client, created_lead):
        lid = created_lead["id"]
        # add contact_made activity
        client.post(f"{API}/activities", json={
            "lead_id": lid, "activity_type": "call", "description": "called"
        })
        # add site visit
        client.post(f"{API}/leads/{lid}/site-visit", json={
            "gps_lat": 19.07, "gps_lng": 72.87, "gps_accuracy": 10,
            "site_address": "Mumbai", "requirement_notes": "Need PA",
            "photos": ["abc"], "videos": []
        })
        r = client.get(f"{API}/leads/{lid}")
        assert r.status_code == 200
        d = r.json()
        # 10 base + 10 contact + 30 gps + 20 photos + 20 notes = 90
        assert d["health_score"] >= 90, f"Expected >=90, got {d['health_score']}"


# ---------------- Quotations ----------------
class TestQuotations:
    def test_create_quotation_with_extras_and_status(self, client, created_lead):
        payload = {
            "lead_id": created_lead["id"],
            "items": [
                {"sku": "SHURE-SM58", "product_name": "Shure SM58",
                 "quantity": 2, "unit_price": 10000, "discount_pct": 10, "gst_rate": 18}
            ],
            "installation_charge": 5000,
            "freight_charge": 2000,
            "amc_charge": 3000,
            "misc_charge": 1000,
            "status": "Sent",
        }
        r = client.post(f"{API}/quotations", json=payload)
        assert r.status_code == 200, f"Create quotation failed: {r.text}"
        d = r.json()
        assert d["status"] == "Sent"
        totals = d["totals"]
        # items: 2*10000=20000; disc=2000; tax=(18000)*0.18=3240
        # extras=5000+2000+3000+1000=11000; extras_tax=11000*0.18=1980
        # total = 20000-2000+3240+11000+1980 = 34220
        assert totals["extras"] == 11000, f"extras={totals['extras']}"
        assert totals["subtotal"] == 20000
        assert totals["discount"] == 2000
        assert round(totals["tax"], 2) == 5220.0  # 3240 + 1980
        assert round(totals["total"], 2) == 34220.0
        # store for next test
        TestQuotations.qid = d["id"]
        TestQuotations.lead_id = created_lead["id"]
        TestQuotations.qnum = d["quotation_number"]

    def test_update_quotation_status_logs_activity(self, client):
        qid = TestQuotations.qid
        r = client.put(f"{API}/quotations/{qid}/status", json={"status": "Approved"})
        assert r.status_code == 200
        assert r.json()["status"] == "Approved"
        # check activity
        r2 = client.get(f"{API}/leads/{TestQuotations.lead_id}/activities")
        assert r2.status_code == 200
        acts = r2.json()
        assert any(a.get("activity_type") == "quotation_status" and "Approved" in a.get("description", "")
                   for a in acts), f"Quotation status activity not logged"

    def test_invalid_quotation_status(self, client):
        qid = TestQuotations.qid
        r = client.put(f"{API}/quotations/{qid}/status", json={"status": "NotAStatus"})
        assert r.status_code == 400


# ---------------- Cleanup ----------------
@pytest.fixture(scope="session", autouse=True)
def cleanup(request, client):
    yield
    # Delete TEST_ leads created
    try:
        r = client.get(f"{API}/leads")
        if r.status_code == 200:
            for l in r.json():
                if (l.get("lead_name") or "").startswith("TEST_"):
                    client.delete(f"{API}/leads/{l['id']}")
    except Exception:
        pass
