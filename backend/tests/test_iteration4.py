"""NMP Sales OS Phase 2 round 4 - Full LMS upgrade
- Training CRUD with video_type
- mark-watched (idempotent)
- submit-quiz pass/fail
- certificate endpoint
- 403 for non-admin on create/update/delete
- Regression: auth, KPI, pipeline, follow-ups, quotations w/ extras,
  employee admin actions, closure_type guard
"""
import os
import uuid
import pytest
import requests

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
def non_admin_session(admin):
    """Create a field_sales employee + accept invite + login. Used for 403 checks."""
    unique = uuid.uuid4().hex[:8]
    payload = {
        "name": f"TEST_NonAdmin_{unique}",
        "email": f"nonadmin_{unique}@example.com",
        "mobile": "9000000111",
        "department": "Sales",
        "designation": "Executive",
        "territory": "West",
        "role": "field_sales",
    }
    r = admin.post(f"{API}/employees", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    new_pw = "Pass1234!"
    ra = requests.post(f"{API}/employees/invite-accept",
                       json={"token": d["invite_token"], "password": new_pw})
    assert ra.status_code == 200, ra.text
    rl = requests.post(f"{API}/auth/login", json={"email": payload["email"], "password": new_pw})
    assert rl.status_code == 200, rl.text
    token = rl.json()["token"]
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    s.emp_id = d["employee"]["id"]
    return s


# ---------- LMS: GET /api/training ----------
class TestTrainingList:
    def test_six_seeded_modules_with_video_type_and_progress(self, admin):
        r = admin.get(f"{API}/training")
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 6, f"Expected >=6 seeded trainings, got {len(items)}"

        required_keys = {"id", "title", "category", "duration", "description",
                         "video_url", "video_type", "quiz", "progress"}
        for t in items:
            missing = required_keys - set(t.keys())
            assert not missing, f"Training {t.get('title')} missing keys: {missing}"
            assert t["video_type"] in {"Training Video", "Product Demo", "SOP Video"}, \
                f"Bad video_type: {t['video_type']}"
            assert isinstance(t["quiz"], list)
            assert isinstance(t["progress"], dict)

    def test_video_type_distribution_2_each(self, admin):
        items = admin.get(f"{API}/training").json()
        types = [t["video_type"] for t in items]
        for vt in ["Training Video", "Product Demo", "SOP Video"]:
            assert types.count(vt) >= 2, f"Expected >=2 of '{vt}', got {types.count(vt)}"


# ---------- LMS: POST /api/training (admin only) ----------
class TestTrainingCreate:
    def test_admin_can_create(self, admin):
        payload = {
            "title": "TEST_NewTraining",
            "category": "Sales",
            "duration": "10 min",
            "description": "Created by test",
            "video_url": "https://youtu.be/xyz",
            "video_type": "Training Video",
            "quiz": [{"q": "1+1?", "options": ["1", "2", "3"], "answer": 1}],
        }
        r = admin.post(f"{API}/training", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d
        assert d["title"] == payload["title"]
        assert d["video_type"] == "Training Video"
        assert len(d["quiz"]) == 1
        # Cleanup
        admin.delete(f"{API}/training/{d['id']}")

    def test_non_admin_403(self, non_admin_session):
        payload = {"title": "TEST_ShouldFail", "category": "Sales",
                   "video_type": "SOP Video", "quiz": []}
        r = non_admin_session.post(f"{API}/training", json=payload)
        assert r.status_code == 403, f"Non-admin should get 403, got {r.status_code}: {r.text}"


# ---------- LMS: PUT /api/training/{id} (admin only) ----------
class TestTrainingUpdate:
    def test_admin_update_and_persist(self, admin):
        # Create temp
        cp = admin.post(f"{API}/training", json={
            "title": "TEST_ToUpdate", "category": "Product",
            "video_type": "Product Demo", "quiz": []
        })
        tid = cp.json()["id"]
        # Update
        ru = admin.put(f"{API}/training/{tid}",
                       json={"title": "TEST_Updated", "duration": "99 min"})
        assert ru.status_code == 200, ru.text
        d = ru.json()
        assert d["title"] == "TEST_Updated"
        assert d["duration"] == "99 min"
        # Verify via GET
        items = admin.get(f"{API}/training").json()
        me = next((t for t in items if t["id"] == tid), None)
        assert me and me["title"] == "TEST_Updated"
        # Cleanup
        admin.delete(f"{API}/training/{tid}")

    def test_non_admin_update_403(self, admin, non_admin_session):
        cp = admin.post(f"{API}/training", json={
            "title": "TEST_NonAdminUpdate", "category": "Product",
            "video_type": "Product Demo", "quiz": []
        })
        tid = cp.json()["id"]
        r = non_admin_session.put(f"{API}/training/{tid}", json={"title": "Hack"})
        assert r.status_code == 403
        admin.delete(f"{API}/training/{tid}")


# ---------- LMS: DELETE /api/training/{id} (admin only) ----------
class TestTrainingDelete:
    def test_delete_removes_training_and_progress(self, admin):
        # Create training
        cp = admin.post(f"{API}/training", json={
            "title": "TEST_ToDelete", "category": "Sales",
            "video_type": "Training Video",
            "quiz": [{"q": "x?", "options": ["a", "b"], "answer": 0}],
        })
        tid = cp.json()["id"]
        # Create a progress doc by mark-watched
        rw = admin.post(f"{API}/training/{tid}/mark-watched")
        assert rw.status_code == 200
        # Delete
        rd = admin.delete(f"{API}/training/{tid}")
        assert rd.status_code == 200
        # Verify training gone
        items = admin.get(f"{API}/training").json()
        assert not any(t["id"] == tid for t in items)
        # Verify certificate / progress endpoint returns 404 (progress also wiped)
        rc = admin.get(f"{API}/training/{tid}/certificate")
        assert rc.status_code == 404

    def test_non_admin_delete_403(self, admin, non_admin_session):
        cp = admin.post(f"{API}/training", json={
            "title": "TEST_ND_Del", "category": "Sales",
            "video_type": "Training Video", "quiz": []
        })
        tid = cp.json()["id"]
        r = non_admin_session.delete(f"{API}/training/{tid}")
        assert r.status_code == 403
        admin.delete(f"{API}/training/{tid}")


# ---------- LMS: mark-watched ----------
class TestMarkWatched:
    def test_idempotent_upsert(self, admin):
        items = admin.get(f"{API}/training").json()
        tid = items[-1]["id"]
        for _ in range(3):
            r = admin.post(f"{API}/training/{tid}/mark-watched")
            assert r.status_code == 200
            assert r.json().get("ok") is True
        # Verify reflected on GET training
        items2 = admin.get(f"{API}/training").json()
        me = next(t for t in items2 if t["id"] == tid)
        prog = me["progress"]
        assert prog.get("video_watched") is True
        # Progress status should be In Progress (unless an earlier test set Certified on this id)
        assert prog.get("status") in ("In Progress", "Certified", "Failed")


# ---------- LMS: submit-quiz ----------
class TestSubmitQuiz:
    def test_pass_returns_certificate_number(self, admin):
        items = admin.get(f"{API}/training").json()
        # Pick a Training Video with quiz
        target = next(t for t in items if t["video_type"] == "Training Video" and t["quiz"])
        correct = [q["answer"] for q in target["quiz"]]
        r = admin.post(f"{API}/training/{target['id']}/submit-quiz",
                       json={"answers": correct})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["passed"] is True
        assert d["score"] >= 70
        assert d["certificate_number"].startswith("NMP-CERT-")

    def test_fail_no_certificate(self, admin):
        items = admin.get(f"{API}/training").json()
        target = next(t for t in items if t["video_type"] == "Product Demo" and t["quiz"])
        # Wrong answers
        wrong = [(q["answer"] + 1) % len(q["options"]) for q in target["quiz"]]
        r = admin.post(f"{API}/training/{target['id']}/submit-quiz",
                       json={"answers": wrong})
        assert r.status_code == 200
        d = r.json()
        assert d["passed"] is False
        assert d["certificate_number"] in ("", None)


# ---------- LMS: certificate ----------
class TestCertificate:
    def test_404_before_pass(self, admin):
        # Use a brand-new training so user has no progress
        cp = admin.post(f"{API}/training", json={
            "title": "TEST_CertNone", "category": "Sales",
            "video_type": "Training Video",
            "quiz": [{"q": "?", "options": ["a", "b"], "answer": 0}],
        })
        tid = cp.json()["id"]
        rc = admin.get(f"{API}/training/{tid}/certificate")
        assert rc.status_code == 404
        admin.delete(f"{API}/training/{tid}")

    def test_certificate_after_pass(self, admin):
        cp = admin.post(f"{API}/training", json={
            "title": "TEST_CertOK", "category": "Sales",
            "video_type": "Training Video",
            "quiz": [
                {"q": "q1?", "options": ["a", "b"], "answer": 1},
                {"q": "q2?", "options": ["x", "y"], "answer": 0},
            ],
        })
        tid = cp.json()["id"]
        admin.post(f"{API}/training/{tid}/submit-quiz", json={"answers": [1, 0]})
        rc = admin.get(f"{API}/training/{tid}/certificate")
        assert rc.status_code == 200, rc.text
        cert = rc.json()
        for k in ["certificate_number", "user_name", "training_title", "score", "issue_date"]:
            assert k in cert and cert[k] not in (None, ""), f"missing/empty: {k}"
        assert cert["training_title"] == "TEST_CertOK"
        assert cert["certificate_number"].startswith("NMP-CERT-")
        admin.delete(f"{API}/training/{tid}")


# ---------- Regression: prior endpoints ----------
class TestRegression:
    def test_login(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_dashboard_kpis_has_quotation_approval_rate(self, admin):
        r = admin.get(f"{API}/dashboard/kpis")
        assert r.status_code == 200
        d = r.json()
        assert "quotation_approval_rate" in d
        v = d["quotation_approval_rate"]
        assert isinstance(v, (int, float)) and 0 <= v <= 100

    def test_pipeline_seven_stages(self, admin):
        r = admin.get(f"{API}/pipeline")
        assert r.status_code == 200
        d = r.json()
        # Could be list of stages or dict; accept either
        if isinstance(d, list):
            assert len(d) >= 7, f"Expected 7 stages, got {len(d)}"
        elif isinstance(d, dict):
            stages = d.get("stages") or d
            assert len(stages) >= 7

    def test_follow_ups_buckets(self, admin):
        r = admin.get(f"{API}/follow-ups")
        assert r.status_code == 200
        d = r.json()
        for k in ["today", "overdue", "upcoming"]:
            assert k in d, f"missing bucket {k}"
            assert isinstance(d[k], list)

    def test_quotation_create_with_extras(self, admin):
        lead = admin.post(f"{API}/leads",
                          json={"lead_name": "TEST_QuoteLead", "expected_deal_value": 50000}).json()
        payload = {
            "lead_id": lead["id"],
            "items": [{"product_name": "TEST_Item", "quantity": 2,
                       "unit_price": 10000, "discount_pct": 5, "gst_rate": 18}],
            "status": "Draft",
            "payment_terms": "50% advance",
            "delivery_terms": "2 weeks",
            "validity_days": 30,
        }
        r = admin.post(f"{API}/quotations", json=payload)
        assert r.status_code == 200, r.text
        q = r.json()
        assert "id" in q and "quotation_number" in q
        # Cleanup
        admin.delete(f"{API}/leads/{lead['id']}")

    def test_employee_admin_actions(self, admin):
        unique = uuid.uuid4().hex[:8]
        payload = {
            "name": f"TEST_Reg_{unique}",
            "email": f"reg_{unique}@example.com",
            "mobile": "9000123456",
            "department": "Sales",
            "designation": "Executive",
            "territory": "West",
            "role": "field_sales",
        }
        rc = admin.post(f"{API}/employees", json=payload)
        assert rc.status_code == 200
        eid = rc.json()["employee"]["id"]
        # suspend
        rs = admin.post(f"{API}/employees/{eid}/suspend")
        assert rs.status_code == 200
        # resend-invite
        rr = admin.post(f"{API}/employees/{eid}/resend-invite")
        assert rr.status_code == 200 and "invite_token" in rr.json()
        # reset-password
        rp = admin.post(f"{API}/employees/{eid}/reset-password")
        assert rp.status_code == 200 and "temp_password" in rp.json()

    def test_closure_type_guard(self, admin):
        lead = admin.post(f"{API}/leads",
                          json={"lead_name": "TEST_ClosureRegLead",
                                "expected_deal_value": 100000,
                                "status": "Negotiation"}).json()
        lid = lead["id"]
        # Won without closure_type rejected
        r = admin.put(f"{API}/leads/{lid}", json={"status": "Won"})
        assert r.status_code == 400
        # With closure_type works
        r2 = admin.put(f"{API}/leads/{lid}",
                       json={"status": "Won", "closure_type": "Product Sale"})
        assert r2.status_code == 200
        admin.delete(f"{API}/leads/{lid}")


# ---------- Cleanup ----------
@pytest.fixture(scope="session", autouse=True)
def cleanup_session(admin):
    yield
    # Wipe lingering TEST_ trainings
    try:
        items = admin.get(f"{API}/training").json()
        for t in items:
            if (t.get("title") or "").startswith("TEST_"):
                admin.delete(f"{API}/training/{t['id']}")
    except Exception:
        pass
    # Wipe lingering TEST_ leads
    try:
        leads = admin.get(f"{API}/leads").json()
        for l in leads:
            if (l.get("lead_name") or "").startswith("TEST_"):
                admin.delete(f"{API}/leads/{l['id']}")
    except Exception:
        pass
