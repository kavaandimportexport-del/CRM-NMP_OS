"""NMP Sales OS Phase 2 round 3 - admin actions, LMS, playbooks/knowledge, KPI, stale-nudge"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pro-audio-crm.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@nmp.com"
ADMIN_PASSWORD = "admin123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin(admin_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"})
    return s


@pytest.fixture(scope="session")
def test_employee(admin):
    """Create a dedicated test employee to perform admin actions on."""
    unique = uuid.uuid4().hex[:8]
    payload = {
        "name": f"TEST_Employee_{unique}",
        "email": f"test_emp_{unique}@example.com",
        "mobile": "9000000000",
        "department": "Sales",
        "designation": "Executive",
        "territory": "West",
        "role": "field_sales",
    }
    r = admin.post(f"{API}/employees", json=payload)
    assert r.status_code == 200, f"Create employee failed: {r.text}"
    data = r.json()
    assert "invite_token" in data and "temp_password" in data
    emp = data["employee"]
    assert emp["status"] == "Pending"
    return {"id": emp["id"], "email": emp["email"], "temp_password": data["temp_password"],
            "invite_token": data["invite_token"], "name": emp["name"]}


# ---------- Auth & login_history ----------
class TestAuthAndLoginHistory:
    def test_login_records_success_history(self, admin, test_employee):
        # Accept the invite at /employees/invite-accept (correct path)
        new_pw = "Pass1234!"
        r = requests.post(f"{API}/employees/invite-accept",
                          json={"token": test_employee["invite_token"], "password": new_pw})
        assert r.status_code == 200, r.text
        test_employee["password"] = new_pw

        # Successful login
        r = requests.post(f"{API}/auth/login",
                         json={"email": test_employee["email"], "password": new_pw})
        assert r.status_code == 200
        token = r.json()["token"]
        test_employee["token"] = token

        # token should include tv claim
        import jwt as _jwt
        decoded = _jwt.decode(token, options={"verify_signature": False})
        assert "tv" in decoded, f"token payload missing 'tv': {decoded}"

        # Failed login attempt
        rf = requests.post(f"{API}/auth/login",
                           json={"email": test_employee["email"], "password": "wrongpw"})
        assert rf.status_code == 401

        # Admin reads login-history
        time.sleep(0.5)
        rh = admin.get(f"{API}/employees/{test_employee['id']}/login-history")
        assert rh.status_code == 200, rh.text
        hist = rh.json()
        assert isinstance(hist, list) and len(hist) >= 2
        # Check sorted desc by 'at'
        ats = [h["at"] for h in hist if h.get("at")]
        assert ats == sorted(ats, reverse=True)
        # Has at least one success and one failure
        successes = [h for h in hist if h.get("success") is True]
        failures = [h for h in hist if h.get("success") is False]
        assert len(successes) >= 1 and len(failures) >= 1


# ---------- Employee admin actions ----------
class TestEmployeeAdminActions:
    def test_suspend_increments_token_version_and_blocks(self, admin, test_employee):
        old_token = test_employee["token"]
        r = admin.post(f"{API}/employees/{test_employee['id']}/suspend")
        assert r.status_code == 200
        # Old token now invalid (session revoked OR account suspended)
        rm = requests.get(f"{API}/auth/me",
                          headers={"Authorization": f"Bearer {old_token}"})
        assert rm.status_code in (401, 403), f"got {rm.status_code}: {rm.text}"
        # Login also blocked
        rl = requests.post(f"{API}/auth/login",
                           json={"email": test_employee["email"], "password": test_employee["password"]})
        assert rl.status_code == 403

    def test_activate_restores(self, admin, test_employee):
        r = admin.post(f"{API}/employees/{test_employee['id']}/activate")
        assert r.status_code == 200
        # Verify GET shows Active
        rg = admin.get(f"{API}/employees")
        emps = rg.json()
        me = next((e for e in emps if e["id"] == test_employee["id"]), None)
        assert me and me["status"] == "Active"
        # Login should succeed
        rl = requests.post(f"{API}/auth/login",
                           json={"email": test_employee["email"], "password": test_employee["password"]})
        assert rl.status_code == 200
        test_employee["token"] = rl.json()["token"]

    def test_force_logout_revokes_old_token(self, admin, test_employee):
        old_token = test_employee["token"]
        r = admin.post(f"{API}/employees/{test_employee['id']}/force-logout")
        assert r.status_code == 200
        rm = requests.get(f"{API}/auth/me",
                          headers={"Authorization": f"Bearer {old_token}"})
        assert rm.status_code == 401
        body = rm.json()
        assert "revoked" in (body.get("detail") or "").lower() or body.get("detail") == "Session revoked"

    def test_reset_password_returns_new_pw_and_revokes_old(self, admin, test_employee):
        # Re-login first to get fresh token
        rl = requests.post(f"{API}/auth/login",
                           json={"email": test_employee["email"], "password": test_employee["password"]})
        assert rl.status_code == 200
        old_token = rl.json()["token"]

        r = admin.post(f"{API}/employees/{test_employee['id']}/reset-password")
        assert r.status_code == 200
        new_pw = r.json().get("temp_password")
        assert isinstance(new_pw, str) and len(new_pw) > 0

        # Old token must fail with 401 (Session revoked)
        rm = requests.get(f"{API}/auth/me",
                          headers={"Authorization": f"Bearer {old_token}"})
        assert rm.status_code == 401

        # Old password must no longer work
        ro = requests.post(f"{API}/auth/login",
                           json={"email": test_employee["email"], "password": test_employee["password"]})
        assert ro.status_code == 401

        # New password works
        rn = requests.post(f"{API}/auth/login",
                           json={"email": test_employee["email"], "password": new_pw})
        assert rn.status_code == 200
        test_employee["password"] = new_pw
        test_employee["token"] = rn.json()["token"]

    def test_resend_invite(self, admin, test_employee):
        r = admin.post(f"{API}/employees/{test_employee['id']}/resend-invite")
        assert r.status_code == 200
        d = r.json()
        assert "invite_token" in d and len(d["invite_token"]) > 10
        # Status should now be Pending
        emps = admin.get(f"{API}/employees").json()
        me = next((e for e in emps if e["id"] == test_employee["id"]), None)
        assert me and me["status"] == "Pending"

    def test_revoke_invite(self, admin, test_employee):
        r = admin.post(f"{API}/employees/{test_employee['id']}/revoke-invite")
        assert r.status_code == 200
        emps = admin.get(f"{API}/employees").json()
        me = next((e for e in emps if e["id"] == test_employee["id"]), None)
        assert me and me["status"] == "Inactive"

    def test_terminate_blocks_subsequent_login(self, admin, test_employee):
        # Reactivate + give a known password
        admin.post(f"{API}/employees/{test_employee['id']}/activate")
        rp = admin.post(f"{API}/employees/{test_employee['id']}/reset-password")
        new_pw = rp.json()["temp_password"]
        # Verify login works pre-terminate
        rl = requests.post(f"{API}/auth/login",
                           json={"email": test_employee["email"], "password": new_pw})
        assert rl.status_code == 200

        # Terminate
        rt = admin.post(f"{API}/employees/{test_employee['id']}/terminate")
        assert rt.status_code == 200
        # Login must now return 403
        rl2 = requests.post(f"{API}/auth/login",
                            json={"email": test_employee["email"], "password": new_pw})
        assert rl2.status_code == 403


# ---------- Leads closure_type guard ----------
class TestClosureTypeGuard:
    @pytest.fixture(scope="class")
    def lead_id(self, admin):
        payload = {"lead_name": "TEST_ClosureLead", "expected_deal_value": 100000,
                   "status": "Negotiation"}
        r = admin.post(f"{API}/leads", json=payload)
        assert r.status_code == 200
        return r.json()["id"]

    def test_won_without_closure_type_rejected(self, admin, lead_id):
        r = admin.put(f"{API}/leads/{lead_id}", json={"status": "Won"})
        assert r.status_code == 400
        assert "closure_type" in (r.json().get("detail") or "").lower()

    def test_won_with_closure_type_succeeds(self, admin, lead_id):
        r = admin.put(f"{API}/leads/{lead_id}",
                      json={"status": "Won", "closure_type": "Product Sale"})
        assert r.status_code == 200
        assert r.json()["status"] == "Won"
        assert r.json()["closure_type"] == "Product Sale"


# ---------- Playbooks ----------
class TestPlaybooks:
    def test_seeded_six(self, admin):
        r = admin.get(f"{API}/playbooks")
        assert r.status_code == 200
        pbs = r.json()
        assert isinstance(pbs, list) and len(pbs) >= 6
        cats = {p["category"] for p in pbs}
        for required in ["Church Sales", "School Sales", "Studio Sales", "Corporate AV",
                         "Event Companies", "Government Projects"]:
            assert required in cats, f"missing playbook: {required}"

    def test_crud(self, admin):
        # Create
        payload = {"category": "TEST_Cat", "discovery_questions": ["q1?"], "objections": [],
                   "products": ["p1"], "checklist": ["c1"]}
        r = admin.post(f"{API}/playbooks", json=payload)
        assert r.status_code == 200
        pid = r.json()["id"]
        # Update
        ru = admin.put(f"{API}/playbooks/{pid}", json={"category": "TEST_Cat_Updated"})
        assert ru.status_code == 200
        assert ru.json()["category"] == "TEST_Cat_Updated"
        # Delete
        rd = admin.delete(f"{API}/playbooks/{pid}")
        assert rd.status_code == 200
        pbs = admin.get(f"{API}/playbooks").json()
        assert not any(p["id"] == pid for p in pbs)


# ---------- Knowledge ----------
class TestKnowledge:
    def test_get_published_only(self, admin):
        r = admin.get(f"{API}/knowledge")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        for k in items:
            assert k.get("published") is True

    def test_unpublished_excluded(self, admin):
        # create unpublished
        payload = {"category": "TEST", "title": "TEST_unpub", "body": "x", "published": False}
        r = admin.post(f"{API}/knowledge", json=payload)
        assert r.status_code == 200
        kid = r.json()["id"]
        # list shouldn't include it
        items = admin.get(f"{API}/knowledge").json()
        assert not any(k["id"] == kid for k in items)
        # cleanup
        admin.delete(f"{API}/knowledge/{kid}")

    def test_crud(self, admin):
        payload = {"category": "TEST", "title": "TEST_kb", "body": "body", "published": True}
        r = admin.post(f"{API}/knowledge", json=payload)
        assert r.status_code == 200
        kid = r.json()["id"]
        ru = admin.put(f"{API}/knowledge/{kid}", json={"title": "TEST_kb_v2"})
        assert ru.status_code == 200 and ru.json()["title"] == "TEST_kb_v2"
        rd = admin.delete(f"{API}/knowledge/{kid}")
        assert rd.status_code == 200


# ---------- Training (LMS) ----------
class TestTraining:
    def test_list_five_with_progress(self, admin):
        r = admin.get(f"{API}/training")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 5
        for t in items:
            assert "progress" in t
            assert "quiz" in t

    def test_submit_quiz_pass_and_certificate(self, admin):
        items = admin.get(f"{API}/training").json()
        target = items[0]
        tid = target["id"]
        # All correct answers
        correct_answers = [q["answer"] for q in target["quiz"]]
        r = admin.post(f"{API}/training/{tid}/submit-quiz",
                       json={"answers": correct_answers})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["passed"] is True
        assert d["score"] >= 70
        assert d["certificate_number"] and d["certificate_number"].startswith("NMP-CERT-")

        # Get certificate
        rc = admin.get(f"{API}/training/{tid}/certificate")
        assert rc.status_code == 200
        cert = rc.json()
        for k in ["certificate_number", "user_name", "training_title", "score", "issue_date"]:
            assert k in cert, f"missing {k}"

    def test_submit_quiz_fail_no_cert(self, admin):
        items = admin.get(f"{API}/training").json()
        # Pick a different module to avoid overwriting the cert
        target = items[1]
        tid = target["id"]
        wrong = [(q["answer"] + 1) % len(q["options"]) for q in target["quiz"]]
        r = admin.post(f"{API}/training/{tid}/submit-quiz", json={"answers": wrong})
        assert r.status_code == 200
        d = r.json()
        assert d["passed"] is False
        assert d["certificate_number"] in ("", None)

        # No certificate
        rc = admin.get(f"{API}/training/{tid}/certificate")
        assert rc.status_code == 404


# ---------- Dashboard KPI: quotation_approval_rate ----------
class TestQuotationApprovalKPI:
    def test_kpi_has_field(self, admin):
        r = admin.get(f"{API}/dashboard/kpis")
        assert r.status_code == 200
        d = r.json()
        assert "quotation_approval_rate" in d
        v = d["quotation_approval_rate"]
        assert isinstance(v, (int, float))
        assert 0 <= v <= 100


# ---------- Stale quotation nudge ----------
class TestStaleNudge:
    def test_run_stale_nudge_idempotent(self, admin):
        # Create a Sent quotation and backdate it
        lead = admin.post(f"{API}/leads",
                          json={"lead_name": "TEST_StaleLead", "expected_deal_value": 50000}).json()
        q_payload = {
            "lead_id": lead["id"],
            "items": [{"product_name": "X", "quantity": 1, "unit_price": 10000,
                       "discount_pct": 0, "gst_rate": 18}],
            "status": "Sent",
        }
        q = admin.post(f"{API}/quotations", json=q_payload).json()
        # Backdate via direct mongo-equivalent: use update endpoint? not available. Use PUT? Not available.
        # Instead rely on backend test by directly hitting mongo via a tiny helper.
        from pymongo import MongoClient
        mc = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        dbname = os.environ.get("DB_NAME", "test_database")
        from bson import ObjectId
        old_iso = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        mc[dbname].quotations.update_one({"_id": ObjectId(q["id"])},
                                         {"$set": {"created_at": old_iso}})

        r = admin.post(f"{API}/quotations/run-stale-nudge")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["tasks_created"] >= 1
        created_first = d["tasks_created"]

        # Idempotency: second call must not create duplicate
        r2 = admin.post(f"{API}/quotations/run-stale-nudge")
        assert r2.status_code == 200
        # Check tasks for this lead — should be exactly 1 with that title
        tasks = admin.get(f"{API}/tasks", params={"lead_id": lead["id"]}).json()
        nudge_tasks = [t for t in tasks if t.get("title", "").startswith(f"Follow-up: {q['quotation_number']}")]
        assert len(nudge_tasks) == 1, f"Duplicate nudge tasks created: {len(nudge_tasks)}"


# ---------- Cleanup ----------
@pytest.fixture(scope="session", autouse=True)
def cleanup(request, admin):
    yield
    # Clean test data
    try:
        leads = admin.get(f"{API}/leads").json()
        for l in leads:
            if (l.get("lead_name") or "").startswith("TEST_"):
                admin.delete(f"{API}/leads/{l['id']}")
    except Exception:
        pass
    try:
        emps = admin.get(f"{API}/employees").json()
        for e in emps:
            if (e.get("name") or "").startswith("TEST_Employee_"):
                # No delete endpoint; mark terminated already done in tests
                pass
    except Exception:
        pass
