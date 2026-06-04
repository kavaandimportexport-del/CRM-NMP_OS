from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import secrets
import bcrypt
import jwt
import base64
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from bson import ObjectId

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr

# ---------- Setup ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@nmp.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NMP Sales OS")
api = APIRouter(prefix="/api")

# ---------- Helpers ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": datetime.now(timezone.utc) + timedelta(hours=24), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    doc.pop("password_hash", None)
    return doc

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(401, "User not found")
        return serialize(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

def require_roles(*roles):
    async def checker(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return checker

# ---------- Models ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str

class SetupAdminIn(BaseModel):
    email: EmailStr
    password: str
    name: str

class EmployeeIn(BaseModel):
    name: str
    email: EmailStr
    mobile: Optional[str] = ""
    department: Optional[str] = ""
    designation: Optional[str] = ""
    territory: Optional[str] = ""
    role: str = "field_sales"
    reporting_manager: Optional[str] = ""

class InviteAcceptIn(BaseModel):
    token: str
    password: str

class LeadIn(BaseModel):
    lead_name: str
    company_name: Optional[str] = ""
    contact_person: Optional[str] = ""
    mobile: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    lead_source: str = "Website"
    lead_type: str = "Product Sale"
    visit_requirement: str = "Not Required"
    expected_deal_value: float = 0
    priority: str = "Medium"
    assigned_to: Optional[str] = ""
    status: str = "New"
    notes: Optional[str] = ""

class SiteVisitIn(BaseModel):
    gps_lat: float
    gps_lng: float
    gps_accuracy: Optional[float] = 0
    site_address: Optional[str] = ""
    requirement_notes: Optional[str] = ""
    photos: List[str] = []
    videos: List[str] = []

class TaskIn(BaseModel):
    lead_id: Optional[str] = ""
    title: str
    description: Optional[str] = ""
    task_type: str = "Follow-Up"
    assigned_to: Optional[str] = ""
    due_date: Optional[str] = ""
    status: str = "Open"

class QuotationItem(BaseModel):
    sku: Optional[str] = ""
    product_name: str
    quantity: int = 1
    unit_price: float = 0
    discount_pct: float = 0
    gst_rate: float = 18

class QuotationIn(BaseModel):
    lead_id: str
    quotation_number: Optional[str] = ""
    items: List[QuotationItem]
    terms: Optional[str] = "50% advance, balance against delivery. Warranty as per brand."
    notes: Optional[str] = ""

class InventoryItem(BaseModel):
    sku: str
    product_name: str
    brand: Optional[str] = ""
    category: Optional[str] = ""
    cost_price: float = 0
    selling_price: float = 0
    mrp: float = 0
    gst_rate: float = 18
    stock: int = 0
    warehouse: Optional[str] = ""

class ActivityIn(BaseModel):
    lead_id: str
    activity_type: str
    description: str

# ---------- Auth ----------
@api.get("/auth/setup-status")
async def setup_status():
    count = await db.users.count_documents({"role": "super_admin"})
    return {"setup_complete": count > 0}

@api.post("/auth/setup-admin")
async def setup_admin(body: SetupAdminIn, response: Response):
    if await db.users.count_documents({"role": "super_admin"}) > 0:
        raise HTTPException(400, "Super admin already exists")
    user = {
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "super_admin",
        "status": "Active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(user)
    token = create_access_token(str(res.inserted_id), user["email"], "super_admin")
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=86400, path="/")
    user["id"] = str(res.inserted_id)
    return {"user": serialize(user), "token": token}

@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    if user.get("status") == "Inactive":
        raise HTTPException(403, "Account is inactive")
    token = create_access_token(str(user["_id"]), user["email"], user["role"])
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=86400, path="/")
    return {"user": serialize(user), "token": token}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ---------- Employees ----------
@api.get("/employees")
async def list_employees(user: dict = Depends(get_current_user)):
    users = await db.users.find().sort("created_at", -1).to_list(500)
    return [serialize(u) for u in users]

@api.post("/employees")
async def create_employee(body: EmployeeIn, user: dict = Depends(require_roles("super_admin", "admin"))):
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(400, "Email already exists")
    invite_token = secrets.token_urlsafe(24)
    temp_pw = secrets.token_urlsafe(8)
    doc = {
        **body.model_dump(),
        "email": body.email.lower(),
        "password_hash": hash_password(temp_pw),
        "status": "Pending",
        "invite_token": invite_token,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    return {"employee": serialize(doc), "invite_token": invite_token, "temp_password": temp_pw}

@api.put("/employees/{employee_id}")
async def update_employee(employee_id: str, body: dict, user: dict = Depends(require_roles("super_admin", "admin"))):
    body.pop("password_hash", None); body.pop("_id", None); body.pop("id", None)
    await db.users.update_one({"_id": ObjectId(employee_id)}, {"$set": body})
    u = await db.users.find_one({"_id": ObjectId(employee_id)})
    return serialize(u)

@api.post("/employees/invite-accept")
async def invite_accept(body: InviteAcceptIn, response: Response):
    u = await db.users.find_one({"invite_token": body.token})
    if not u:
        raise HTTPException(400, "Invalid invite token")
    await db.users.update_one(
        {"_id": u["_id"]},
        {"$set": {"password_hash": hash_password(body.password), "status": "Active"},
         "$unset": {"invite_token": ""}},
    )
    token = create_access_token(str(u["_id"]), u["email"], u["role"])
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=86400, path="/")
    u = await db.users.find_one({"_id": u["_id"]})
    return {"user": serialize(u), "token": token}

# ---------- Leads ----------
def lead_health_score(lead: dict) -> int:
    score = 10
    if lead.get("contact_made"): score += 10
    sv = lead.get("site_visit") or {}
    if sv.get("gps_lat"): score += 30
    if sv.get("photos"): score += 20
    if sv.get("requirement_notes"): score += 20
    if lead.get("quotation_count", 0) > 0: score += 10
    return min(score, 100)

@api.get("/leads")
async def list_leads(user: dict = Depends(get_current_user), status: Optional[str] = None,
                     lead_type: Optional[str] = None, assigned: Optional[str] = None):
    q = {}
    if user["role"] in ("field_sales", "store_sales"):
        q["assigned_to"] = user["id"]
    if status: q["status"] = status
    if lead_type: q["lead_type"] = lead_type
    if assigned: q["assigned_to"] = assigned
    leads = await db.leads.find(q).sort("created_at", -1).to_list(1000)
    result = []
    for l in leads:
        l = serialize(l)
        l["quotation_count"] = await db.quotations.count_documents({"lead_id": l["id"]})
        l["health_score"] = lead_health_score(l)
        result.append(l)
    return result

@api.post("/leads")
async def create_lead(body: LeadIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["created_by"] = user["id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["updated_at"] = doc["created_at"]
    if not doc.get("assigned_to"):
        doc["assigned_to"] = user["id"]
    res = await db.leads.insert_one(doc)
    lead_id = str(res.inserted_id)
    await db.activities.insert_one({
        "lead_id": lead_id, "activity_type": "lead_created",
        "description": f"Lead created by {user['name']}",
        "user_id": user["id"], "user_name": user["name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    doc["id"] = lead_id
    return serialize(doc)

@api.get("/leads/{lead_id}")
async def get_lead(lead_id: str, user: dict = Depends(get_current_user)):
    l = await db.leads.find_one({"_id": ObjectId(lead_id)})
    if not l:
        raise HTTPException(404, "Not found")
    l = serialize(l)
    l["quotation_count"] = await db.quotations.count_documents({"lead_id": lead_id})
    l["health_score"] = lead_health_score(l)
    return l

@api.put("/leads/{lead_id}")
async def update_lead(lead_id: str, body: dict, user: dict = Depends(get_current_user)):
    body.pop("_id", None); body.pop("id", None)
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.leads.update_one({"_id": ObjectId(lead_id)}, {"$set": body})
    if "status" in body:
        await db.activities.insert_one({
            "lead_id": lead_id, "activity_type": "status_change",
            "description": f"Status changed to {body['status']}",
            "user_id": user["id"], "user_name": user["name"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    l = await db.leads.find_one({"_id": ObjectId(lead_id)})
    return serialize(l)

@api.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user: dict = Depends(require_roles("super_admin", "admin", "sales_manager"))):
    await db.leads.delete_one({"_id": ObjectId(lead_id)})
    return {"ok": True}

@api.post("/leads/{lead_id}/site-visit")
async def add_site_visit(lead_id: str, body: SiteVisitIn, user: dict = Depends(get_current_user)):
    site_data = body.model_dump()
    site_data["executive_id"] = user["id"]
    site_data["executive_name"] = user["name"]
    site_data["timestamp"] = datetime.now(timezone.utc).isoformat()
    await db.leads.update_one(
        {"_id": ObjectId(lead_id)},
        {"$set": {"site_visit": site_data, "updated_at": site_data["timestamp"]}},
    )
    await db.activities.insert_one({
        "lead_id": lead_id, "activity_type": "gps_visit",
        "description": f"GPS-verified site visit by {user['name']}",
        "user_id": user["id"], "user_name": user["name"],
        "created_at": site_data["timestamp"],
    })
    return {"ok": True}

# ---------- Activities ----------
@api.post("/activities")
async def add_activity(body: ActivityIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["user_id"] = user["id"]
    doc["user_name"] = user["name"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.activities.insert_one(doc)
    if body.activity_type in ("call", "whatsapp", "meeting"):
        await db.leads.update_one({"_id": ObjectId(body.lead_id)}, {"$set": {"contact_made": True}})
    doc["id"] = str(res.inserted_id)
    return serialize(doc)

@api.get("/leads/{lead_id}/activities")
async def lead_activities(lead_id: str, user: dict = Depends(get_current_user)):
    acts = await db.activities.find({"lead_id": lead_id}).sort("created_at", -1).to_list(500)
    return [serialize(a) for a in acts]

# ---------- Tasks ----------
@api.get("/tasks")
async def list_tasks(user: dict = Depends(get_current_user), lead_id: Optional[str] = None):
    q = {}
    if lead_id: q["lead_id"] = lead_id
    if user["role"] in ("field_sales", "store_sales") and not lead_id:
        q["assigned_to"] = user["id"]
    tasks = await db.tasks.find(q).sort("created_at", -1).to_list(500)
    return [serialize(t) for t in tasks]

@api.post("/tasks")
async def create_task(body: TaskIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["created_by"] = user["id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    if not doc.get("assigned_to"):
        doc["assigned_to"] = user["id"]
    res = await db.tasks.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    return serialize(doc)

@api.put("/tasks/{task_id}")
async def update_task(task_id: str, body: dict, user: dict = Depends(get_current_user)):
    body.pop("_id", None); body.pop("id", None)
    await db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": body})
    t = await db.tasks.find_one({"_id": ObjectId(task_id)})
    return serialize(t)

# ---------- Quotations ----------
def calc_quotation(items: List[dict]) -> dict:
    sub = 0; disc = 0; tax = 0
    for it in items:
        line = it["quantity"] * it["unit_price"]
        d = line * it.get("discount_pct", 0) / 100
        taxable = line - d
        t = taxable * it.get("gst_rate", 18) / 100
        sub += line; disc += d; tax += t
    return {"subtotal": round(sub, 2), "discount": round(disc, 2),
            "tax": round(tax, 2), "total": round(sub - disc + tax, 2)}

@api.get("/quotations")
async def list_quotations(user: dict = Depends(get_current_user), lead_id: Optional[str] = None):
    q = {}
    if lead_id: q["lead_id"] = lead_id
    quots = await db.quotations.find(q).sort("created_at", -1).to_list(500)
    return [serialize(qq) for qq in quots]

@api.post("/quotations")
async def create_quotation(body: QuotationIn, user: dict = Depends(get_current_user)):
    items = [i.model_dump() for i in body.items]
    totals = calc_quotation(items)
    count = await db.quotations.count_documents({})
    qnum = body.quotation_number or f"NMP-Q-{datetime.now().year}-{count+1:05d}"
    doc = {
        "lead_id": body.lead_id,
        "quotation_number": qnum,
        "items": items, "terms": body.terms, "notes": body.notes,
        "totals": totals, "version": 1, "status": "Draft",
        "created_by": user["id"], "created_by_name": user["name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.quotations.insert_one(doc)
    await db.activities.insert_one({
        "lead_id": body.lead_id, "activity_type": "quotation_created",
        "description": f"Quotation {qnum} created (Total INR {totals['total']})",
        "user_id": user["id"], "user_name": user["name"],
        "created_at": doc["created_at"],
    })
    doc["id"] = str(res.inserted_id)
    return serialize(doc)

@api.get("/quotations/{qid}")
async def get_quotation(qid: str, user: dict = Depends(get_current_user)):
    q = await db.quotations.find_one({"_id": ObjectId(qid)})
    if not q:
        raise HTTPException(404, "Not found")
    return serialize(q)

# ---------- Inventory ----------
@api.get("/inventory")
async def list_inventory(user: dict = Depends(get_current_user), search: Optional[str] = None):
    q = {}
    if search:
        q = {"$or": [{"product_name": {"$regex": search, "$options": "i"}},
                     {"sku": {"$regex": search, "$options": "i"}},
                     {"brand": {"$regex": search, "$options": "i"}}]}
    items = await db.inventory.find(q).limit(500).to_list(500)
    return [serialize(i) for i in items]

@api.post("/inventory")
async def create_inventory(body: InventoryItem, user: dict = Depends(require_roles("super_admin", "admin"))):
    doc = body.model_dump()
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.inventory.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    return serialize(doc)

@api.post("/inventory/bulk-import")
async def bulk_import(items: List[InventoryItem], user: dict = Depends(require_roles("super_admin", "admin"))):
    docs = []
    for it in items:
        d = it.model_dump()
        d["created_at"] = datetime.now(timezone.utc).isoformat()
        docs.append(d)
    if docs:
        await db.inventory.insert_many(docs)
    return {"imported": len(docs)}

# ---------- Dashboard ----------
@api.get("/dashboard/kpis")
async def dashboard_kpis(user: dict = Depends(get_current_user)):
    q = {}
    if user["role"] in ("field_sales", "store_sales"):
        q["assigned_to"] = user["id"]
    total = await db.leads.count_documents(q)
    open_q = {**q, "status": {"$nin": ["Won", "Lost"]}}
    open_leads = await db.leads.count_documents(open_q)
    won = await db.leads.count_documents({**q, "status": "Won"})
    lost = await db.leads.count_documents({**q, "status": "Lost"})
    gps_verified = await db.leads.count_documents({**q, "site_visit.gps_lat": {"$exists": True}})
    visit_pending = await db.leads.count_documents({**q, "visit_requirement": "Mandatory",
                                                    "site_visit.gps_lat": {"$exists": False}})
    quots_q = {}
    if user["role"] in ("field_sales", "store_sales"):
        quots_q["created_by"] = user["id"]
    quotations_sent = await db.quotations.count_documents(quots_q)
    won_leads = await db.leads.find({**q, "status": "Won"}).to_list(1000)
    revenue = sum(l.get("expected_deal_value", 0) for l in won_leads)
    conv_rate = round((won / total * 100), 1) if total else 0
    pipeline = await db.leads.aggregate([
        {"$match": q}, {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]).to_list(50)
    status_breakdown = {p["_id"]: p["count"] for p in pipeline}
    src_pipe = await db.leads.aggregate([
        {"$match": q}, {"$group": {"_id": "$lead_source", "count": {"$sum": 1}}},
    ]).to_list(50)
    source_breakdown = [{"source": s["_id"], "count": s["count"]} for s in src_pipe]
    return {"total_leads": total, "open_leads": open_leads, "deals_won": won, "deals_lost": lost,
            "gps_verified": gps_verified, "visit_pending": visit_pending,
            "quotations_sent": quotations_sent, "revenue": revenue,
            "conversion_rate": conv_rate, "status_breakdown": status_breakdown,
            "source_breakdown": source_breakdown}

# ---------- File Upload ----------
@api.post("/files/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 5MB)")
    encoded = base64.b64encode(content).decode("utf-8")
    doc = {"filename": file.filename, "content_type": file.content_type,
           "data": encoded, "size": len(content),
           "uploaded_by": user["id"],
           "uploaded_at": datetime.now(timezone.utc).isoformat()}
    res = await db.files.insert_one(doc)
    fid = str(res.inserted_id)
    return {"id": fid, "url": f"/api/files/{fid}", "filename": file.filename,
            "content_type": file.content_type}

@api.get("/files/{file_id}")
async def get_file(file_id: str):
    doc = await db.files.find_one({"_id": ObjectId(file_id)})
    if not doc:
        raise HTTPException(404, "Not found")
    content = base64.b64decode(doc["data"])
    return Response(content=content, media_type=doc.get("content_type", "application/octet-stream"))

# ---------- Knowledge / Playbooks / Training (static) ----------
PLAYBOOKS = [
    {"id": "church", "category": "Church Sales",
     "discovery_questions": ["Seating capacity?", "Reverb/echo issues?", "Existing PA system?", "Worship style?", "Live streaming required?"],
     "objections": [{"o": "Too expensive", "r": "Show 10-year TCO vs cheap systems."}, {"o": "We will think about it", "r": "Offer free acoustic survey."}],
     "products": ["Line array speakers", "Wireless mics (Shure/Sennheiser)", "Digital mixer", "In-ear monitoring", "Acoustic treatment"],
     "checklist": ["Site survey done", "GPS verified", "Acoustic photos", "Stakeholder list", "Quotation v1 sent"]},
    {"id": "school", "category": "School Sales",
     "discovery_questions": ["Auditorium size?", "Assembly type?", "Music classroom needs?", "Existing PA?", "Budget cycle?"],
     "objections": [{"o": "Government tender required", "r": "We provide GeM-compliant quotes."}],
     "products": ["Column speakers", "Lapel mic systems", "Portable PA", "Conference mics"],
     "checklist": ["Principal meeting", "Site visit + photos", "Tender format", "Proposal submitted"]},
    {"id": "studio", "category": "Studio Sales",
     "discovery_questions": ["Genre focus?", "Tracks recorded?", "DAW preference?", "Monitoring?", "Treatment?"],
     "objections": [{"o": "I can buy online", "r": "We offer installation + calibration + warranty."}],
     "products": ["Audio interfaces", "Studio monitors", "Acoustic treatment", "Condenser mics", "Headphones"],
     "checklist": ["Studio walkthrough", "Acoustic photos", "Signal chain", "Demo session"]},
    {"id": "corporate_av", "category": "Corporate AV",
     "discovery_questions": ["Meeting rooms?", "VC platform?", "BYOD or fixed?", "Control system?"],
     "objections": [{"o": "IT will handle it", "r": "Offer joint demo with IT head."}],
     "products": ["Ceiling mics", "Video bars", "Display screens", "Control automation"],
     "checklist": ["Floor plan", "IT alignment", "PoC done", "Maintenance AMC quoted"]},
    {"id": "event", "category": "Event Companies",
     "discovery_questions": ["Avg event size?", "Rental fleet gaps?", "Tour requirements?"],
     "objections": [{"o": "Cash flow tight", "r": "Easy EMI / lease finance."}],
     "products": ["Line arrays", "Subwoofers", "Wireless systems", "Lighting controllers"],
     "checklist": ["Warehouse demo", "Trial event", "Service contract", "Spare kit"]},
    {"id": "government", "category": "Government Projects",
     "discovery_questions": ["Tender ID?", "Compliance docs?", "Site location?", "Timeline?"],
     "objections": [{"o": "L1 only", "r": "Highlight 5-year service inclusion."}],
     "products": ["IP-rated speakers", "PA systems", "Conference systems", "Translation"],
     "checklist": ["Tender review", "Site visit", "Bid submitted", "Tech approval"]},
]

KNOWLEDGE_HUB = [
    {"id": "k1", "category": "Product Guide", "title": "Choosing the Right Line Array",
     "body": "Line arrays project sound over long throws with even coverage. Use for auditoriums over 300 seats, churches with high ceilings, or outdoor events."},
    {"id": "k2", "category": "Brand Guide", "title": "Shure SM58 vs Sennheiser e835",
     "body": "SM58: industry-standard, very durable. e835: brighter top end, lower handling noise. Recommend SM58 for live worship; e835 for spoken-word."},
    {"id": "k3", "category": "FAQ", "title": "Treatment vs Soundproofing?",
     "body": "Treatment improves sound INSIDE a room. Soundproofing stops sound from passing THROUGH walls. Churches need treatment; studios often need both."},
    {"id": "k4", "category": "Troubleshooting", "title": "Feedback during worship",
     "body": "Check mic placement vs monitors. Engage HPF below 80Hz. Use EQ to notch ringing freq. Consider in-ear monitors."},
    {"id": "k5", "category": "Competitor", "title": "Why NMP vs Online Stores",
     "body": "Online stores cannot do site surveys, acoustic measurement, installation, training, or AMC. NMP provides full lifecycle support."},
    {"id": "k6", "category": "Sales Talk", "title": "Opening a Church Conversation",
     "body": "Ask: How did Sunday service feel? Could everyone hear clearly? When was the last system upgrade?"},
    {"id": "k7", "category": "Installation", "title": "Auditorium Install Checklist",
     "body": "Cable runs, conduit, rigging certification, power isolation, equipment rack, signal flow diagram, commissioning report, customer training."},
]

TRAINING_MODULES = [
    {"id": "t1", "title": "NMP Sales Process 101", "category": "Sales", "duration": "20 min",
     "description": "Lead-centric selling. Site visit discipline, GPS, photos, follow-up cadence."},
    {"id": "t2", "title": "Pro Audio Basics", "category": "Product", "duration": "45 min",
     "description": "Microphones, speakers, mixers, signal flow, gain staging, dB scale."},
    {"id": "t3", "title": "Church Audio Masterclass", "category": "Product", "duration": "30 min",
     "description": "Worship audio needs, contemporary vs traditional, monitoring, live streaming."},
    {"id": "t4", "title": "Quotation Writing", "category": "Sales", "duration": "15 min",
     "description": "Structuring quotes, discount discipline, GST, payment terms."},
    {"id": "t5", "title": "Installation SOP", "category": "Technical", "duration": "60 min",
     "description": "Site preparation, safety, rigging, commissioning, handover."},
]

@api.get("/playbooks")
async def get_playbooks(user: dict = Depends(get_current_user)):
    return PLAYBOOKS

@api.get("/knowledge")
async def get_knowledge(user: dict = Depends(get_current_user)):
    return KNOWLEDGE_HUB

@api.get("/training")
async def get_training(user: dict = Depends(get_current_user)):
    return TRAINING_MODULES

# ---------- Wiring ----------
app.include_router(api)

origins = [o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',') if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins if origins != ['*'] else ['*'],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.leads.create_index("assigned_to")
    await db.leads.create_index("status")
    if await db.users.count_documents({"role": "super_admin"}) == 0:
        await db.users.insert_one({
            "email": ADMIN_EMAIL.lower(),
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Super Admin",
            "role": "super_admin",
            "status": "Active",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded super admin: {ADMIN_EMAIL}")

@app.on_event("shutdown")
async def shutdown():
    client.close()
