import React, { useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell,
} from "recharts";
import {
  LayoutDashboard, Store, Receipt, ChefHat, Megaphone, Settings as Cog, Leaf, Plus, Minus,
  ShoppingBag, Repeat, Tag, Printer, TrendingUp, Carrot, ClipboardList, Sparkles, Gift, Users,
  MessageSquare, Check, Flame, Wheat, Milk, Nut, Fish, ArrowUpRight, Target, Star, Trash2,
  CalendarDays, Pause, Play, CreditCard, User, Clock, ChevronRight, BadgeCheck, UtensilsCrossed,
  X, MapPin, Navigation, Truck, Monitor, Banknote, Wallet, Layers, Send, Calendar,
} from "lucide-react";

/* =================================================================== */
/*  DATA                                                                */
/* =================================================================== */

const DIET_OPTS = ["High Protein", "Low Carb", "Plant-Based", "Keto"];
const DIETS = ["All", ...DIET_OPTS];
const ALLERGENS = ["gluten", "dairy", "nuts", "fish"];
const ALLERGEN_ICON = { gluten: Wheat, dairy: Milk, nuts: Nut, fish: Fish };
const SWATCHES = ["#8a5a3c", "#5e6b4a", "#3f5c5a", "#9a5142", "#6b5b3e", "#4a5240", "#7a4a4a", "#566073"];
const UNITS = ["oz", "cup", "tbsp", "tsp", "ea", "g", "lb"];
const STATION = { "High Protein": "Grill", Keto: "Grill", "Low Carb": "Sauté", "Plant-Based": "Cold Station" };

const INIT_MEALS = [
  { id: "m1", name: "Grilled Chicken & Quinoa", diet: "High Protein", price: 12.5, swatch: "#8a5a3c", desc: "Lean chicken, fluffy quinoa, roasted broccoli.", macros: { cal: 540, protein: 42, carbs: 48, fat: 16 }, allergens: [], ingredients: [{ name: "Chicken breast", qty: 6, unit: "oz", trim: 0.12 }, { name: "Quinoa", qty: 0.75, unit: "cup", trim: 0.02 }, { name: "Broccoli", qty: 1, unit: "cup", trim: 0.18 }, { name: "Olive oil", qty: 1, unit: "tbsp", trim: 0 }] },
  { id: "m2", name: "Salmon & Sweet Potato", diet: "High Protein", price: 14.0, swatch: "#9a5142", desc: "Omega-rich salmon with roasted sweet potato.", macros: { cal: 610, protein: 38, carbs: 44, fat: 28 }, allergens: ["fish"], ingredients: [{ name: "Salmon fillet", qty: 6, unit: "oz", trim: 0.1 }, { name: "Sweet potato", qty: 1, unit: "ea", trim: 0.15 }, { name: "Asparagus", qty: 1, unit: "cup", trim: 0.22 }, { name: "Olive oil", qty: 1, unit: "tbsp", trim: 0 }] },
  { id: "m3", name: "Vegan Buddha Bowl", diet: "Plant-Based", price: 11.0, swatch: "#5e6b4a", desc: "Chickpeas, brown rice, kale, tahini drizzle.", macros: { cal: 480, protein: 19, carbs: 62, fat: 18 }, allergens: ["nuts"], ingredients: [{ name: "Chickpeas", qty: 0.75, unit: "cup", trim: 0.03 }, { name: "Brown rice", qty: 0.75, unit: "cup", trim: 0.02 }, { name: "Kale", qty: 1, unit: "cup", trim: 0.25 }, { name: "Tahini", qty: 1, unit: "tbsp", trim: 0 }] },
  { id: "m4", name: "Steak & Roasted Veg", diet: "Keto", price: 15.5, swatch: "#7a4a4a", desc: "Sirloin with brussels sprouts & sweet potato.", macros: { cal: 660, protein: 46, carbs: 30, fat: 38 }, allergens: [], ingredients: [{ name: "Sirloin steak", qty: 6, unit: "oz", trim: 0.14 }, { name: "Brussels sprouts", qty: 1, unit: "cup", trim: 0.2 }, { name: "Sweet potato", qty: 1, unit: "ea", trim: 0.15 }, { name: "Olive oil", qty: 1, unit: "tbsp", trim: 0 }] },
  { id: "m5", name: "Turkey Meatballs & Zoodles", diet: "Low Carb", price: 12.0, swatch: "#6b5b3e", desc: "Turkey meatballs over zucchini noodles.", macros: { cal: 420, protein: 36, carbs: 18, fat: 22 }, allergens: ["dairy"], ingredients: [{ name: "Ground turkey", qty: 5, unit: "oz", trim: 0.08 }, { name: "Zucchini", qty: 2, unit: "ea", trim: 0.2 }, { name: "Marinara", qty: 0.5, unit: "cup", trim: 0 }, { name: "Parmesan", qty: 1, unit: "tbsp", trim: 0 }] },
  { id: "m6", name: "Shrimp Cauli-Rice", diet: "Low Carb", price: 13.0, swatch: "#3f5c5a", desc: "Garlic shrimp over cauliflower fried rice.", macros: { cal: 390, protein: 32, carbs: 22, fat: 16 }, allergens: ["fish"], ingredients: [{ name: "Shrimp", qty: 5, unit: "oz", trim: 0.1 }, { name: "Cauliflower rice", qty: 1.5, unit: "cup", trim: 0.15 }, { name: "Egg", qty: 1, unit: "ea", trim: 0 }, { name: "Soy sauce", qty: 1, unit: "tbsp", trim: 0 }] },
];

const PLANS = [
  { id: "starter", name: "Starter", meals: 5, perMeal: 11.5, blurb: "For trying us out" },
  { id: "pro", name: "Pro", meals: 10, perMeal: 10.5, blurb: "Our most popular plan", popular: true },
  { id: "athlete", name: "Athlete", meals: 14, perMeal: 9.9, blurb: "Fuel every single day" },
];
const COUPONS = { FRESH10: { type: "percent", value: 10, label: "10% off" }, WELCOME5: { type: "flat", value: 5, label: "$5 off" } };

const SEED_ORDERS = [
  { id: 1042, customer: "Maria Lopez", type: "subscription", day: "Mon", items: { m1: 3, m3: 2 }, addr: "418 Cedar Ave", zone: "North" },
  { id: 1043, customer: "Dwayne King", type: "one-time", day: "Mon", items: { m4: 4, m2: 1 }, addr: "92 Birch St", zone: "North" },
  { id: 1044, customer: "Priya Sharma", type: "subscription", day: "Mon", items: { m3: 5 }, addr: "1200 Lakeshore Rd", zone: "East" },
  { id: 1045, customer: "Tom Reyes", type: "one-time", day: "Mon", items: { m1: 2, m5: 2, m6: 2 }, addr: "57 Maple Crt", zone: "East" },
  { id: 1046, customer: "Aisha Bello", type: "subscription", day: "Mon", items: { m2: 3, m4: 3 }, addr: "780 Elm Blvd", zone: "West" },
  { id: 1047, customer: "Greg Park", type: "one-time", day: "Mon", items: { m5: 4, m6: 2 }, addr: "311 Oak Lane", zone: "West" },
];

const SEED_GIFTCARDS = [
  { code: "GIFT-7K2P", amount: 75, balance: 40, recipient: "alex@email.com" },
  { code: "GIFT-9XR4", amount: 50, balance: 50, recipient: "sam@email.com" },
];

const CUSTOMER_HISTORY = [{ id: 1042, date: "Jun 15, 2026", meals: 5, total: 53.5 }, { id: 1021, date: "Jun 8, 2026", meals: 5, total: 53.5 }, { id: 1004, date: "Jun 1, 2026", meals: 5, total: 57.0 }];
const REVENUE_TREND = [{ w: "Wk 1", rev: 2840 }, { w: "Wk 2", rev: 3120 }, { w: "Wk 3", rev: 2990 }, { w: "Wk 4", rev: 3680 }, { w: "Wk 5", rev: 4210 }, { w: "Wk 6", rev: 4790 }, { w: "Wk 7", rev: 5240 }, { w: "Wk 8", rev: 6010 }];

const STAFF = [
  { name: "Carlos M.", role: "Head Chef", rate: 28 },
  { name: "Nina P.", role: "Prep Cook", rate: 19 },
  { name: "Devon R.", role: "Prep Cook", rate: 19 },
  { name: "Sasha L.", role: "Packer", rate: 17 },
  { name: " Imani K.", role: "Driver", rate: 21 },
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHIFTS = [
  ["6a–2p", "6a–2p", "off", "6a–2p", "6a–2p", "5a–1p"],
  ["5a–1p", "5a–1p", "5a–1p", "off", "5a–1p", "5a–11a"],
  ["off", "7a–3p", "7a–3p", "7a–3p", "7a–3p", "off"],
  ["8a–4p", "off", "8a–4p", "8a–4p", "8a–4p", "7a–12p"],
  ["off", "9a–3p", "off", "9a–3p", "9a–3p", "8a–2p"],
];

const fmt = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt0 = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const round = (n) => (Number.isInteger(n) ? n : Number(n).toFixed(2));
const findMeal = (meals, id) => meals.find((m) => m.id === id);
const orderTotal = (meals, o) => Object.entries(o.items).reduce((s, [id, q]) => { const m = findMeal(meals, id); return s + (m ? m.price * q : 0); }, 0);
const orderCount = (o) => Object.values(o.items).reduce((a, b) => a + b, 0);

function PlateMark({ color, size = 46 }) {
  return (<svg width={size} height={size} viewBox="0 0 46 46" fill="none"><circle cx="23" cy="23" r="16" stroke={color} strokeWidth="1.1" opacity="0.55" /><circle cx="23" cy="23" r="9.5" stroke={color} strokeWidth="1.1" opacity="0.38" /></svg>);
}

/* =================================================================== */
/*  ROOT                                                                */
/* =================================================================== */

const NAV = [
  ["dashboard", "Dashboard", LayoutDashboard], ["storefront", "Storefront", Store],
  ["customer", "Customer App", User], ["pos", "POS Terminal", Wallet], ["orders", "Orders", Receipt],
  ["kitchen", "Kitchen OS", ChefHat], ["routes", "Delivery Routes", Truck],
  ["marketing", "Marketing", Megaphone], ["staff", "Staff", Users], ["settings", "Settings", Cog],
];

const DEFAULT_SETTINGS = {
  brand: "#2f4536", subDiscount: 15, deliveryFee: 4.99, processingFee: 1.5, taxRate: 8, minOrder: 35,
  cutoff: "Sat 8:00 PM", minMeals: 3, fulfillment: "both",
  deliveryDays: { Mon: true, Tue: false, Wed: true, Thu: false, Fri: true, Sat: false, Sun: false },
  pickupLocations: ["Downtown Commissary", "Westside Pickup Hub"],
};

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [meals, setMeals] = useState(INIT_MEALS);
  const [orders, setOrders] = useState(SEED_ORDERS);
  const [giftCards, setGiftCards] = useState(SEED_GIFTCARDS);
  const [nextId, setNextId] = useState(1048);
  const [sub, setSub] = useState({ planId: "pro", frequency: "weekly", status: "active", nextDelivery: "Mon, Jun 22", meals: { m1: 3, m3: 4, m5: 3 } });
  const placeOrder = (o) => { setOrders((p) => [{ ...o, id: nextId }, ...p]); setNextId((n) => n + 1); return nextId; };

  return (
    <div className="w-full min-h-screen flex" style={{ background: "var(--paper)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;450;500;600&display=swap');
        :root{ --paper:#f4f2ec; --surface:#ffffff; --ink:#1f1e1a; --ink-soft:#56534b; --muted:#8a857a;
          --line:#e7e3d8; --sand:#ece8df; --pine:${settings.brand}; --clay:#a85a3f; --sidebar:#1b1a16; }
        *{font-family:'Inter',sans-serif; box-sizing:border-box; -webkit-font-smoothing:antialiased;}
        .disp{font-family:'Fraunces',serif; letter-spacing:-0.01em;}
        .fade{animation:fade .45s cubic-bezier(.2,.7,.3,1) both;}
        @keyframes fade{from{opacity:0;transform:translateY(7px);}to{opacity:1;transform:none;}}
        .recharts-tooltip-wrapper{outline:none;}
        @media print{.no-print{display:none!important;} .print-full{width:100%!important;}}
        ::-webkit-scrollbar{width:9px;height:9px;} ::-webkit-scrollbar-thumb{background:#d9d4c6;border-radius:9px;}
        input,select,textarea{font-family:'Inter',sans-serif;}
        input::placeholder,textarea::placeholder{color:#b3ada0;}
      `}</style>

      <aside className="no-print w-[224px] shrink-0 flex flex-col px-3 py-5 sticky top-0 h-screen overflow-y-auto" style={{ background: "var(--sidebar)" }}>
        <div className="flex items-center gap-2.5 px-3 mb-7"><div className="grid place-items-center w-8 h-8 rounded-md" style={{ background: "var(--pine)" }}><Leaf size={17} color="#f4f2ec" /></div><div className="disp text-[19px] font-medium text-[#f4f2ec]">PrepFlow</div></div>
        <div className="px-3 text-[10px] font-semibold tracking-[0.14em] uppercase mb-2" style={{ color: "#ffffff40" }}>Workspace</div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(([id, label, Icon]) => { const on = page === id; return (
            <button key={id} onClick={() => setPage(id)} className="flex items-center gap-3 px-3 py-2 rounded-md text-[13.5px] transition-colors text-left" style={{ background: on ? "#ffffff0e" : "transparent", color: on ? "#f4f2ec" : "#ffffff7a", fontWeight: on ? 500 : 450 }}>
              <Icon size={17} style={{ opacity: on ? 1 : 0.7 }} />{label}{on && <span className="ml-auto w-1 h-1 rounded-full" style={{ background: "var(--clay)" }} />}</button>); })}
        </nav>
        <div className="mt-auto mx-1 rounded-lg px-3.5 py-3" style={{ background: "#ffffff0a", border: "1px solid #ffffff12" }}><div className="text-[#f4f2ec] text-[13px] font-medium mb-0.5">Greenleaf Kitchen</div><p className="text-[11px] leading-snug" style={{ color: "#ffffff5c" }}>{meals.length} menu items · {orders.length} active orders</p></div>
      </aside>

      <main className="flex-1 min-w-0">
        {page === "dashboard" && <Dashboard meals={meals} orders={orders} setPage={setPage} />}
        {page === "storefront" && <Storefront meals={meals} settings={settings} onOrder={placeOrder} />}
        {page === "customer" && <CustomerApp meals={meals} sub={sub} setSub={setSub} />}
        {page === "pos" && <POS meals={meals} settings={settings} onOrder={placeOrder} />}
        {page === "orders" && <Orders meals={meals} orders={orders} />}
        {page === "kitchen" && <Kitchen meals={meals} setMeals={setMeals} orders={orders} />}
        {page === "routes" && <Routes orders={orders} />}
        {page === "marketing" && <Marketing giftCards={giftCards} setGiftCards={setGiftCards} />}
        {page === "staff" && <Staff />}
        {page === "settings" && <SettingsPage settings={settings} setSettings={setSettings} />}
      </main>
    </div>
  );
}

function Head({ kicker, title, sub, right }) {
  return (<div className="flex items-end justify-between gap-4 mb-7 pb-5 flex-wrap" style={{ borderBottom: "1px solid var(--line)" }}>
    <div>{kicker && <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase mb-2.5" style={{ color: "var(--muted)" }}>{kicker}</div>}
      <h1 className="disp text-[30px] leading-none font-medium" style={{ color: "var(--ink)" }}>{title}</h1>
      {sub && <p className="text-[13.5px] mt-2.5" style={{ color: "var(--ink-soft)" }}>{sub}</p>}</div>{right}</div>);
}
const Page = ({ children }) => <div className="fade px-9 py-8 max-w-6xl">{children}</div>;
const Card = ({ children, className = "" }) => <div className={`rounded-xl border p-5 ${className}`} style={{ borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)" }}>{children}</div>;
function CardTitle({ icon, title, note }) { return (<div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><span style={{ color: "var(--pine)" }}>{icon}</span><h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{title}</h3></div>{note && <span className="text-[12px]" style={{ color: "var(--muted)" }}>{note}</span>}</div>); }
const btnPrimary = { background: "var(--pine)", color: "#f4f2ec" };
const INP = "w-full px-3 py-2 rounded-md border text-[13px] outline-none";
function Field({ label, children, className = "" }) { return <div className={className}><label className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>{label}</label>{children}</div>; }
const Tabs = ({ tabs, tab, setTab }) => (
  <div className="no-print inline-flex p-0.5 rounded-lg mb-6 flex-wrap" style={{ background: "var(--sand)", border: "1px solid var(--line)" }}>
    {tabs.map(([id, label, Icon]) => { const on = tab === id; return <button key={id} onClick={() => setTab(id)} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[7px] text-[13px] font-medium transition-colors" style={{ background: on ? "var(--surface)" : "transparent", color: on ? "var(--ink)" : "var(--muted)", boxShadow: on ? "0 1px 2px rgba(31,30,26,.06)" : "none" }}><Icon size={15} />{label}</button>; })}
  </div>
);
function Kpi({ icon, label, value, delta }) {
  return (<div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)" }}>
    <div className="flex items-center justify-between mb-4"><span style={{ color: "var(--muted)" }}>{icon}</span>{delta && <span className="flex items-center gap-0.5 text-[11.5px] font-medium" style={{ color: "#5e7350" }}><ArrowUpRight size={12} />{delta}</span>}</div>
    <div className="disp text-[24px] font-medium leading-none" style={{ color: "var(--ink)" }}>{value}</div><div className="text-[12px] mt-1.5" style={{ color: "var(--muted)" }}>{label}</div></div>);
}

/* =================================================================== */
/*  DASHBOARD                                                           */
/* =================================================================== */

function Dashboard({ meals, orders, setPage }) {
  const revenue = orders.reduce((s, o) => s + orderTotal(meals, o), 0);
  const totMeals = orders.reduce((s, o) => s + orderCount(o), 0);
  const subs = orders.filter((o) => o.type === "subscription").length;
  const aov = revenue / orders.length;
  const topMeals = useMemo(() => { const map = {}; orders.forEach((o) => Object.entries(o.items).forEach(([id, q]) => { map[id] = (map[id] || 0) + q; })); return Object.entries(map).map(([id, q]) => { const m = findMeal(meals, id); return m ? { name: m.name.split(" ")[0], qty: q, swatch: m.swatch } : null; }).filter(Boolean).sort((a, b) => b.qty - a.qty); }, [orders, meals]);
  return (
    <Page>
      <Head kicker="Overview" title="Good morning, Chef" sub="How Greenleaf Kitchen is performing this period." right={<button onClick={() => setPage("storefront")} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium" style={btnPrimary}><Store size={15} /> View storefront</button>} />
      <div className="grid sm:grid-cols-4 gap-3.5 mb-4"><Kpi icon={<TrendingUp size={16} />} label="Revenue (period)" value={fmt0(revenue)} delta="+18%" /><Kpi icon={<ChefHat size={16} />} label="Meals ordered" value={totMeals} delta="+9%" /><Kpi icon={<Repeat size={16} />} label="Active subscriptions" value={subs} delta="+2" /><Kpi icon={<Receipt size={16} />} label="Avg order value" value={fmt(aov)} delta="+$4.10" /></div>
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 mb-4">
        <Card><CardTitle icon={<TrendingUp size={15} />} title="Revenue trend" note="Last 8 weeks" /><div className="h-56 -ml-2"><ResponsiveContainer width="100%" height="100%"><AreaChart data={REVENUE_TREND} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--pine)" stopOpacity={0.18} /><stop offset="100%" stopColor="var(--pine)" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="2 4" stroke="#ece7db" vertical={false} /><XAxis dataKey="w" tick={{ fontSize: 11.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} /><Tooltip formatter={(v) => fmt0(v)} contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12.5, boxShadow: "0 4px 14px rgba(31,30,26,.08)" }} /><Area type="monotone" dataKey="rev" stroke="var(--pine)" strokeWidth={2} fill="url(#g)" /></AreaChart></ResponsiveContainer></div></Card>
        <Card><CardTitle icon={<ChefHat size={15} />} title="Top meals" note="By units" /><div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={topMeals} layout="vertical" margin={{ left: 8, right: 16 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={62} tick={{ fontSize: 11.5, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "#00000006" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12.5 }} /><Bar dataKey="qty" radius={[0, 5, 5, 0]} barSize={18}>{topMeals.map((m, i) => <Cell key={i} fill={m.swatch} />)}</Bar></BarChart></ResponsiveContainer></div></Card>
      </div>
      <Card><CardTitle icon={<Sparkles size={15} />} title="One platform, every tool" note="vs. GoPrep & Sprwt" /><div className="grid sm:grid-cols-4 gap-3.5 mt-1">{[[Wallet, "POS terminal", "Ring up walk-in orders in-store."], [Truck, "Route optimization", "Sequence deliveries by zone."], [Monitor, "Kitchen display", "Live tickets on the line."], [Users, "Staff scheduling", "Shifts, timesheets, labor cost."]].map(([Icon, t, d], i) => (<div key={i} className="rounded-lg p-4" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}><div className="grid place-items-center w-8 h-8 rounded-md mb-3" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--pine)" }}><Icon size={16} /></div><div className="font-semibold text-[13px] mb-1" style={{ color: "var(--ink)" }}>{t}</div><p className="text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>{d}</p></div>))}</div></Card>
    </Page>
  );
}

/* =================================================================== */
/*  STOREFRONT (+ build-your-own)                                       */
/* =================================================================== */

const BYO_BASE = [{ name: "Brown rice", cal: 150, carbs: 32, protein: 3, fat: 1 }, { name: "Quinoa", cal: 160, carbs: 30, protein: 6, fat: 3 }, { name: "Mixed greens", cal: 30, carbs: 6, protein: 2, fat: 0 }, { name: "Cauliflower rice", cal: 60, carbs: 11, protein: 2, fat: 0 }];
const BYO_PROTEIN = [{ name: "Grilled chicken", price: 4, cal: 180, protein: 35, carbs: 0, fat: 4 }, { name: "Steak", price: 5, cal: 240, protein: 30, carbs: 0, fat: 14 }, { name: "Salmon", price: 5, cal: 220, protein: 28, carbs: 0, fat: 13, allergen: "fish" }, { name: "Tofu", price: 3, cal: 140, protein: 15, carbs: 4, fat: 8 }];
const BYO_SIDE = [{ name: "Broccoli", cal: 55, carbs: 11, protein: 4, fat: 1 }, { name: "Sweet potato", cal: 110, carbs: 26, protein: 2, fat: 0 }, { name: "Asparagus", cal: 40, carbs: 7, protein: 4, fat: 0 }, { name: "Avocado", cal: 120, carbs: 6, protein: 1, fat: 11 }];
const BYO_SAUCE = ["Tahini", "Chimichurri", "Teriyaki", "None"];
const BYO_BASE_PRICE = 8;

function Storefront({ meals, settings, onOrder }) {
  const [diet, setDiet] = useState("All");
  const [cart, setCart] = useState({});
  const [built, setBuilt] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [subscribe, setSubscribe] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [err, setErr] = useState("");
  const [placed, setPlaced] = useState(false);
  const { subDiscount: SUB, deliveryFee: DEL, processingFee: PROC, taxRate: TAX, minOrder: MIN } = settings;

  const allMeals = useMemo(() => [...meals, ...built], [meals, built]);
  const lookup = (id) => findMeal(allMeals, id);
  const list = meals.filter((m) => diet === "All" || m.diet === diet);
  const add = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const sub = (id) => setCart((c) => { const n = (c[id] || 0) - 1; const x = { ...c }; if (n <= 0) delete x[id]; else x[id] = n; return x; });
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const subtotal = Object.entries(cart).reduce((s, [id, q]) => s + (lookup(id)?.price || 0) * q, 0);
  const gm = Object.entries(cart).reduce((a, [id, q]) => { const m = lookup(id)?.macros; if (m) { a.cal += m.cal * q; a.protein += m.protein * q; } return a; }, { cal: 0, protein: 0 });
  const subDisc = subscribe ? subtotal * (SUB / 100) : 0;
  let couponAmt = 0; if (coupon) couponAmt = coupon.type === "percent" ? (subtotal - subDisc) * (coupon.value / 100) : Math.min(coupon.value, subtotal - subDisc);
  const after = Math.max(0, subtotal - subDisc - couponAmt);
  const tax = after * (TAX / 100);
  const total = count ? after + tax + DEL + PROC : 0;
  const belowMin = count > 0 && subtotal < MIN;
  const applyCoupon = () => { const c = COUPONS[couponInput.trim().toUpperCase()]; if (c) { setCoupon({ code: couponInput.trim().toUpperCase(), ...c }); setErr(""); } else { setCoupon(null); setErr("That code isn't valid."); } };
  const checkout = () => { onOrder({ customer: "Demo Customer", type: subscribe ? "subscription" : "one-time", day: "Mon", items: { ...cart }, addr: "—", zone: "North" }); setPlaced(true); setTimeout(() => { setCart({}); setBuilt([]); setSubscribe(false); setCoupon(null); setCouponInput(""); setPlaced(false); }, 2200); };
  const onBuild = (meal) => { setBuilt((b) => [...b, meal]); setCart((c) => ({ ...c, [meal.id]: (c[meal.id] || 0) + 1 })); setShowBuilder(false); };

  return (
    <Page>
      <Head kicker="Customer view" title="Order Fresh Meals" sub="The storefront your customers order from — diet filters, allergen labels, build-your-own." right={<button onClick={() => setShowBuilder((s) => !s)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--pine)", color: "var(--pine)", background: showBuilder ? "color-mix(in srgb, var(--pine) 6%, transparent)" : "transparent" }}><UtensilsCrossed size={15} /> Build your own</button>} />
      {showBuilder && <BuildYourOwn onBuild={onBuild} onClose={() => setShowBuilder(false)} />}
      <div className="grid lg:grid-cols-[1fr_336px] gap-6">
        <div>
          <div className="flex gap-1.5 mb-5 flex-wrap">{DIETS.map((d) => (<button key={d} onClick={() => setDiet(d)} className="px-3 py-1.5 rounded-md text-[12.5px] font-medium border transition-colors" style={{ background: diet === d ? "var(--ink)" : "var(--surface)", color: diet === d ? "#f4f2ec" : "var(--ink-soft)", borderColor: diet === d ? "var(--ink)" : "var(--line)" }}>{d}</button>))}</div>
          <div className="grid sm:grid-cols-2 gap-4">{list.map((m, i) => <MealCard key={m.id} meal={m} qty={cart[m.id] || 0} add={() => add(m.id)} sub={() => sub(m.id)} delay={i * 0.03} />)}</div>
        </div>
        <aside className="lg:sticky lg:top-6 h-fit">
          {count > 0 && <Card className="mb-3.5"><div className="flex items-center gap-2 mb-3"><Target size={14} style={{ color: "var(--clay)" }} /><span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>This order's nutrition</span></div><div className="grid grid-cols-2 gap-2"><MacroPill label="Calories" value={gm.cal} /><MacroPill label="Protein" value={`${gm.protein}g`} /></div></Card>}
          <Card>
            <div className="flex items-center gap-2 mb-4"><ShoppingBag size={16} style={{ color: "var(--pine)" }} /><h2 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Your order</h2>{count > 0 && <span className="ml-auto text-[12.5px]" style={{ color: "var(--muted)" }}>{count} meals</span>}</div>
            {count === 0 ? <p className="text-[13px] py-9 text-center" style={{ color: "var(--muted)" }}>Add meals to start your order.</p> : (<>
              <div className="space-y-2 mb-4 max-h-40 overflow-auto">{Object.entries(cart).map(([id, q]) => { const m = lookup(id); return m && <div key={id} className="flex justify-between text-[13px]"><span style={{ color: "var(--ink)" }} className="truncate pr-2">{q}× {m.name}</span><span style={{ color: "var(--muted)" }}>{fmt(m.price * q)}</span></div>; })}</div>
              <button onClick={() => setSubscribe((s) => !s)} className="w-full flex items-center gap-3 p-3 rounded-lg border mb-3 text-left transition-colors" style={{ borderColor: subscribe ? "var(--pine)" : "var(--line)", background: subscribe ? "color-mix(in srgb, var(--pine) 6%, transparent)" : "transparent" }}><div className="grid place-items-center w-8 h-8 rounded-md shrink-0" style={{ background: subscribe ? "var(--pine)" : "var(--sand)" }}><Repeat size={15} color={subscribe ? "#f4f2ec" : "var(--muted)"} /></div><div className="flex-1"><div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>Weekly subscription</div><div className="text-[12px]" style={{ color: "var(--muted)" }}>Save {SUB}% every week</div></div><div className="w-9 h-5 rounded-full p-0.5 transition-colors" style={{ background: subscribe ? "var(--pine)" : "#cfc8b5" }}><div className="w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: subscribe ? "translateX(16px)" : "none" }} /></div></button>
              <div className="flex gap-2 mb-3"><input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="Coupon — try FRESH10" className="flex-1 px-3 py-2 rounded-md border text-[13px] outline-none" style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }} /><button onClick={applyCoupon} className="px-3 rounded-md text-[13px] font-medium" style={{ background: "var(--sand)", color: "var(--ink)" }}>Apply</button></div>
              {coupon && <p className="text-[12px] mb-2 flex items-center gap-1" style={{ color: "var(--pine)" }}><Tag size={12} />{coupon.code} — {coupon.label}</p>}
              {err && <p className="text-[12px] mb-2" style={{ color: "var(--clay)" }}>{err}</p>}
              <div className="space-y-1.5 text-[13px] py-3 border-t border-b mb-3" style={{ borderColor: "var(--line)" }}><Row l="Subtotal" v={fmt(subtotal)} />{subDisc > 0 && <Row l={`Subscription −${SUB}%`} v={`−${fmt(subDisc)}`} green />}{couponAmt > 0 && <Row l="Coupon" v={`−${fmt(couponAmt)}`} green />}<Row l={`Tax (${TAX}%)`} v={fmt(tax)} /><Row l="Delivery" v={fmt(DEL)} /><Row l="Processing" v={fmt(PROC)} /></div>
              <div className="flex justify-between items-baseline mb-3"><span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Total</span><span className="disp text-[22px] font-medium" style={{ color: "var(--pine)" }}>{fmt(total)}</span></div>
              {belowMin && <p className="text-[12px] mb-2.5 px-3 py-2 rounded-md" style={{ background: "color-mix(in srgb, var(--clay) 9%, transparent)", color: "var(--clay)" }}>Minimum order is {fmt(MIN)} — add {fmt(MIN - subtotal)} more.</p>}
              <button onClick={checkout} disabled={placed || belowMin} className="w-full py-2.5 rounded-lg font-medium text-[13.5px] flex items-center justify-center gap-2" style={{ background: placed ? "#5e7350" : belowMin ? "var(--sand)" : "var(--pine)", color: belowMin ? "#b3ada0" : "#f4f2ec" }}>{placed ? <><Check size={17} /> Order placed</> : "Checkout"}</button>
            </>)}
          </Card>
        </aside>
      </div>
    </Page>
  );
}

function BuildYourOwn({ onBuild, onClose }) {
  const [base, setBase] = useState(BYO_BASE[0]);
  const [protein, setProtein] = useState(BYO_PROTEIN[0]);
  const [sides, setSides] = useState([BYO_SIDE[0]]);
  const [sauce, setSauce] = useState("Tahini");
  const toggleSide = (s) => setSides((cur) => cur.find((x) => x.name === s.name) ? cur.filter((x) => x.name !== s.name) : cur.length < 2 ? [...cur, s] : cur);
  const parts = [base, protein, ...sides];
  const macros = parts.reduce((a, p) => ({ cal: a.cal + p.cal, protein: a.protein + (p.protein || 0), carbs: a.carbs + (p.carbs || 0), fat: a.fat + (p.fat || 0) }), { cal: 0, protein: 0, carbs: 0, fat: 0 });
  const price = BYO_BASE_PRICE + protein.price;
  const build = () => onBuild({ id: "byo" + Math.random().toString(36).slice(2, 6), name: `Custom ${protein.name} bowl`, price, swatch: "#566073", diet: "Custom", allergens: protein.allergen ? [protein.allergen] : [], macros, ingredients: [{ name: base.name }, { name: protein.name }, ...sides.map((s) => ({ name: s.name }))], desc: `${base.name}, ${sides.map((s) => s.name).join(", ")}, ${sauce}` });
  const Opt = ({ active, onClick, children }) => <button onClick={onClick} className="px-3 py-1.5 rounded-md text-[12.5px] border transition-colors" style={{ background: active ? "var(--pine)" : "transparent", color: active ? "#f4f2ec" : "var(--ink-soft)", borderColor: active ? "var(--pine)" : "var(--line)" }}>{children}</button>;
  return (
    <Card className="mb-5 fade">
      <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><UtensilsCrossed size={15} style={{ color: "var(--pine)" }} /><h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Build your own bowl</h3></div><button onClick={onClose}><X size={17} style={{ color: "var(--muted)" }} /></button></div>
      <div className="grid lg:grid-cols-[1fr_220px] gap-5">
        <div className="space-y-4">
          <Field label="Base"><div className="flex gap-1.5 flex-wrap">{BYO_BASE.map((b) => <Opt key={b.name} active={base.name === b.name} onClick={() => setBase(b)}>{b.name}</Opt>)}</div></Field>
          <Field label="Protein"><div className="flex gap-1.5 flex-wrap">{BYO_PROTEIN.map((p) => <Opt key={p.name} active={protein.name === p.name} onClick={() => setProtein(p)}>{p.name} +${p.price}</Opt>)}</div></Field>
          <Field label="Sides — pick up to 2"><div className="flex gap-1.5 flex-wrap">{BYO_SIDE.map((s) => <Opt key={s.name} active={!!sides.find((x) => x.name === s.name)} onClick={() => toggleSide(s)}>{s.name}</Opt>)}</div></Field>
          <Field label="Sauce"><div className="flex gap-1.5 flex-wrap">{BYO_SAUCE.map((s) => <Opt key={s} active={sauce === s} onClick={() => setSauce(s)}>{s}</Opt>)}</div></Field>
        </div>
        <div className="rounded-lg p-4 flex flex-col" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
          <div className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Your bowl</div>
          <div className="grid grid-cols-4 gap-1 mb-3 text-center">{[["Cal", macros.cal], ["P", macros.protein + "g"], ["C", macros.carbs + "g"], ["F", macros.fat + "g"]].map(([k, v]) => <div key={k} className="rounded-md py-1.5" style={{ background: "var(--surface)" }}><div className="text-[10px]" style={{ color: "var(--muted)" }}>{k}</div><div className="text-[12.5px] font-semibold" style={{ color: "var(--ink)" }}>{v}</div></div>)}</div>
          <div className="flex items-baseline justify-between mb-3"><span className="text-[13px]" style={{ color: "var(--muted)" }}>Price</span><span className="disp text-[22px] font-medium" style={{ color: "var(--pine)" }}>{fmt(price)}</span></div>
          <button onClick={build} className="mt-auto w-full py-2.5 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5" style={btnPrimary}><Plus size={15} /> Add to order</button>
        </div>
      </div>
    </Card>
  );
}

function MacroPill({ label, value }) { return <div className="rounded-md px-3 py-2" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}><div className="text-[11px]" style={{ color: "var(--muted)" }}>{label}</div><div className="disp text-[17px] font-medium" style={{ color: "var(--ink)" }}>{value}</div></div>; }
function Row({ l, v, green }) { return <div className="flex justify-between"><span style={{ color: "var(--muted)" }}>{l}</span><span style={{ color: green ? "var(--pine)" : "var(--ink)" }}>{v}</span></div>; }

function MealCard({ meal, qty, add, sub, delay }) {
  const [flip, setFlip] = useState(false);
  return (
    <div className="fade rounded-xl border overflow-hidden flex flex-col" style={{ borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)", animationDelay: `${delay}s` }}>
      <div className="h-24 relative grid place-items-center" style={{ background: `${meal.swatch}10` }}><PlateMark color={meal.swatch} /><span className="absolute top-3 left-3 text-[10.5px] tracking-wide px-2 py-0.5 rounded" style={{ background: "var(--surface)", color: meal.swatch, border: `1px solid ${meal.swatch}33` }}>{meal.diet}</span>{meal.allergens.length > 0 && <div className="absolute top-3 right-3 flex gap-1">{meal.allergens.map((a) => { const I = ALLERGEN_ICON[a]; return <span key={a} className="grid place-items-center w-5 h-5 rounded-full" style={{ background: "var(--surface)", border: "1px solid var(--line)" }} title={`Contains ${a}`}><I size={11} color={meal.swatch} /></span>; })}</div>}</div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-[14px] font-semibold leading-snug" style={{ color: "var(--ink)" }}>{meal.name}</h3>
        {meal.desc && <p className="text-[12px] mt-1 mb-1.5 leading-snug" style={{ color: "var(--muted)" }}>{meal.desc}</p>}
        <button onClick={() => setFlip((f) => !f)} className="text-[12px] w-fit mb-3" style={{ color: "var(--pine)" }}>{flip ? "Hide nutrition" : "Nutrition facts"}</button>
        {flip ? <div className="grid grid-cols-4 gap-1 mb-3 text-center">{[["Cal", meal.macros.cal], ["P", meal.macros.protein + "g"], ["C", meal.macros.carbs + "g"], ["F", meal.macros.fat + "g"]].map(([k, v]) => <div key={k} className="rounded-md py-1.5" style={{ background: "var(--paper)" }}><div className="text-[10px]" style={{ color: "var(--muted)" }}>{k}</div><div className="text-[12.5px] font-semibold" style={{ color: "var(--ink)" }}>{v}</div></div>)}</div> : <div className="flex-1" />}
        <div className="flex items-center justify-between mt-auto"><span className="disp text-[17px] font-medium" style={{ color: "var(--ink)" }}>{fmt(meal.price)}</span>{qty === 0 ? <button onClick={add} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[13px] font-medium" style={btnPrimary}><Plus size={14} /> Add</button> : <div className="flex items-center gap-3 px-2 py-1 rounded-md" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}><button onClick={sub}><Minus size={15} style={{ color: "var(--ink)" }} /></button><span className="text-[13px] font-semibold w-4 text-center" style={{ color: "var(--ink)" }}>{qty}</span><button onClick={add}><Plus size={15} style={{ color: "var(--ink)" }} /></button></div>}</div>
      </div>
    </div>
  );
}

/* =================================================================== */
/*  CUSTOMER APP                                                        */
/* =================================================================== */

function CustomerApp({ meals, sub, setSub }) {
  const [tab, setTab] = useState("subscription");
  const plan = PLANS.find((p) => p.id === sub.planId);
  return (
    <Page>
      <Head kicker="Diner account" title="Maria's Account" sub="The logged-in experience your subscribers get — pick a plan, choose meals, manage delivery." />
      <div className="flex items-center gap-3 mb-6 p-3 rounded-xl border" style={{ borderColor: "var(--line)", background: "var(--surface)" }}><div className="grid place-items-center w-10 h-10 rounded-full text-[#f4f2ec] disp font-medium" style={{ background: "var(--pine)" }}>M</div><div className="flex-1"><div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Maria Lopez</div><div className="text-[12px]" style={{ color: "var(--muted)" }}>Member since Jan 2026 · 340 loyalty points</div></div><span className="text-[11px] px-2.5 py-1 rounded-md font-medium" style={{ background: sub.status === "active" ? "color-mix(in srgb, var(--pine) 12%, transparent)" : "var(--sand)", color: sub.status === "active" ? "var(--pine)" : "var(--muted)" }}>{sub.status === "active" ? "Subscription active" : "Paused"}</span></div>
      <Tabs tabs={[["plans", "Plans", CreditCard], ["subscription", "My Subscription", Repeat], ["account", "Account", BadgeCheck]]} tab={tab} setTab={setTab} />
      {tab === "plans" && <PlanPicker sub={sub} setSub={setSub} setTab={setTab} />}
      {tab === "subscription" && <MySubscription meals={meals} sub={sub} setSub={setSub} plan={plan} setTab={setTab} />}
      {tab === "account" && <AccountTab />}
    </Page>
  );
}
function PlanPicker({ sub, setSub, setTab }) {
  return (<div className="grid md:grid-cols-3 gap-4">{PLANS.map((p) => { const active = sub.planId === p.id; return (
    <div key={p.id} className="relative rounded-xl border p-6 flex flex-col" style={{ borderColor: active ? "var(--pine)" : "var(--line)", background: "var(--surface)", borderWidth: active ? 1.5 : 1, boxShadow: "0 1px 2px rgba(31,30,26,.03)" }}>
      {p.popular && <span className="absolute top-5 right-5 text-[10.5px] font-semibold px-2 py-0.5 rounded" style={{ background: "var(--clay)", color: "#f4f2ec" }}>Popular</span>}
      <div className="disp text-[19px] font-medium" style={{ color: "var(--ink)" }}>{p.name}</div><p className="text-[12.5px] mb-5" style={{ color: "var(--muted)" }}>{p.blurb}</p>
      <div className="mb-1"><span className="disp text-[34px] font-medium" style={{ color: "var(--ink)" }}>${p.perMeal}</span><span className="text-[13px]" style={{ color: "var(--muted)" }}> / meal</span></div>
      <div className="text-[12.5px] mb-5 pb-5 border-b" style={{ color: "var(--ink-soft)", borderColor: "var(--line)" }}>{p.meals} meals per week · {fmt(p.meals * p.perMeal)}/wk</div>
      <ul className="space-y-2.5 mb-6 text-[12.5px]">{["Free delivery", "Skip or pause anytime", "Earn loyalty points", p.id !== "starter" ? "Priority support" : "Standard support"].map((f) => <li key={f} className="flex items-center gap-2" style={{ color: "var(--ink-soft)" }}><Check size={13} style={{ color: "var(--pine)" }} />{f}</li>)}</ul>
      <button onClick={() => { setSub((s) => ({ ...s, planId: p.id, status: "active", meals: {} })); setTab("subscription"); }} disabled={active} className="mt-auto w-full py-2.5 rounded-lg text-[13px] font-medium" style={active ? { background: "var(--sand)", color: "var(--muted)" } : btnPrimary}>{active ? "Current plan" : "Choose plan"}</button>
    </div>); })}</div>);
}
function MySubscription({ meals, sub, setSub, plan, setTab }) {
  const [saved, setSaved] = useState(false);
  if (!plan) return <Card className="text-center py-10"><div className="disp text-[17px] font-medium mb-2" style={{ color: "var(--ink)" }}>No active plan</div><p className="text-[13px] mb-4" style={{ color: "var(--muted)" }}>Choose a subscription to get started.</p><button onClick={() => setTab("plans")} className="px-4 py-2.5 rounded-lg text-[13px] font-medium" style={btnPrimary}>Browse plans</button></Card>;
  const selected = Object.values(sub.meals).reduce((a, b) => a + b, 0);
  const full = selected >= plan.meals;
  const addMeal = (id) => { if (!full) setSub((s) => ({ ...s, meals: { ...s.meals, [id]: (s.meals[id] || 0) + 1 } })); };
  const remMeal = (id) => setSub((s) => { const n = (s.meals[id] || 0) - 1; const x = { ...s.meals }; if (n <= 0) delete x[id]; else x[id] = n; return { ...s, meals: x }; });
  const setStatus = (status) => setSub((s) => ({ ...s, status }));
  return (
    <div className="grid lg:grid-cols-[312px_1fr] gap-4">
      <div className="space-y-4">
        <Card><div className="flex items-center justify-between mb-3"><span className="disp text-[17px] font-medium" style={{ color: "var(--ink)" }}>{plan.name} Plan</span><button onClick={() => setTab("plans")} className="text-[12px]" style={{ color: "var(--pine)" }}>Change</button></div>
          <Detail icon={<UtensilsCrossed size={14} />} label="Meals / week" value={plan.meals} /><Detail icon={<CalendarDays size={14} />} label="Next delivery" value={sub.nextDelivery} /><Detail icon={<CreditCard size={14} />} label="Weekly total" value={fmt(plan.meals * plan.perMeal)} />
          <div className="flex items-center justify-between py-2.5 mt-1" style={{ borderTop: "1px solid var(--line)" }}><span className="text-[12.5px] flex items-center gap-2" style={{ color: "var(--muted)" }}><Repeat size={14} /> Frequency</span><div className="flex rounded-md overflow-hidden border" style={{ borderColor: "var(--line)" }}>{["weekly", "biweekly"].map((f) => <button key={f} onClick={() => setSub((s) => ({ ...s, frequency: f }))} className="px-2.5 py-1 text-[12px] font-medium capitalize" style={{ background: sub.frequency === f ? "var(--pine)" : "transparent", color: sub.frequency === f ? "#f4f2ec" : "var(--muted)" }}>{f}</button>)}</div></div>
        </Card>
        <Card><div className="text-[13px] font-semibold mb-3" style={{ color: "var(--ink)" }}>Manage</div><div className="space-y-2">
          <button onClick={() => setSub((s) => ({ ...s, nextDelivery: "Mon, Jun 29" }))} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] border text-left" style={{ borderColor: "var(--line)", color: "var(--ink)" }}><Clock size={14} style={{ color: "var(--clay)" }} /> Skip next delivery</button>
          {sub.status === "active" ? <button onClick={() => setStatus("paused")} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] border text-left" style={{ borderColor: "var(--line)", color: "var(--ink)" }}><Pause size={14} style={{ color: "var(--clay)" }} /> Pause subscription</button> : <button onClick={() => setStatus("active")} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] border text-left" style={{ borderColor: "var(--pine)", color: "var(--pine)", background: "color-mix(in srgb, var(--pine) 6%, transparent)" }}><Play size={14} /> Resume subscription</button>}
        </div></Card>
      </div>
      <Card><CardTitle icon={<UtensilsCrossed size={15} />} title="Choose your meals" note={`${selected}/${plan.meals} selected`} />
        <div className="h-1 rounded-full mb-4 overflow-hidden" style={{ background: "var(--sand)" }}><div className="h-full rounded-full transition-all" style={{ width: `${(selected / plan.meals) * 100}%`, background: full ? "#5e7350" : "var(--pine)" }} /></div>
        <div className="grid sm:grid-cols-2 gap-2.5">{meals.map((m) => { const q = sub.meals[m.id] || 0; return (
          <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg border" style={{ borderColor: q ? "var(--pine)" : "var(--line)", background: q ? "color-mix(in srgb, var(--pine) 4%, transparent)" : "transparent" }}><div className="grid place-items-center w-9 h-9 rounded-md shrink-0" style={{ background: `${m.swatch}14` }}><PlateMark color={m.swatch} size={26} /></div><div className="flex-1 min-w-0"><div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{m.name}</div><div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{m.macros.cal} cal · {m.macros.protein}g protein</div></div>{q === 0 ? <button onClick={() => addMeal(m.id)} disabled={full} className="grid place-items-center w-7 h-7 rounded-md shrink-0" style={{ background: full ? "var(--sand)" : "var(--pine)", color: full ? "#b3ada0" : "#f4f2ec" }}><Plus size={15} /></button> : <div className="flex items-center gap-2 shrink-0"><button onClick={() => remMeal(m.id)}><Minus size={15} style={{ color: "var(--ink)" }} /></button><span className="text-[13px] font-semibold w-4 text-center" style={{ color: "var(--ink)" }}>{q}</span><button onClick={() => addMeal(m.id)} disabled={full}><Plus size={15} style={{ color: full ? "#b3ada0" : "var(--ink)" }} /></button></div>}</div>); })}</div>
        <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }} disabled={selected === 0} className="mt-5 w-full py-2.5 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2" style={saved ? { background: "#5e7350", color: "#f4f2ec" } : selected ? btnPrimary : { background: "var(--sand)", color: "#b3ada0" }}>{saved ? <><Check size={16} /> Selections saved</> : full ? "Confirm selections" : `Select ${plan.meals - selected} more meal${plan.meals - selected > 1 ? "s" : ""}`}</button>
      </Card>
    </div>
  );
}
function Detail({ icon, label, value }) { return <div className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid var(--line)" }}><span className="text-[12.5px] flex items-center gap-2" style={{ color: "var(--muted)" }}>{icon}{label}</span><span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{value}</span></div>; }
function AccountTab() {
  const pts = 340, goal = 500;
  return (<div className="grid lg:grid-cols-2 gap-4">
    <Card><CardTitle icon={<Star size={15} />} title="Loyalty rewards" note="Gold tier" /><div className="rounded-lg p-5 mb-4 text-center" style={{ background: "var(--pine)" }}><div className="disp text-[34px] font-medium text-[#f4f2ec] leading-none">{pts}</div><div className="text-[12px] mt-1.5" style={{ color: "#ffffffaa" }}>points available</div></div><div className="flex justify-between text-[12px] mb-1.5" style={{ color: "var(--muted)" }}><span>{pts} pts</span><span>{goal} pts = $25 reward</span></div><div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--sand)" }}><div className="h-full rounded-full" style={{ width: `${(pts / goal) * 100}%`, background: "var(--clay)" }} /></div><p className="text-[12px] mt-2" style={{ color: "var(--muted)" }}>{goal - pts} points until your next reward.</p></Card>
    <Card><CardTitle icon={<Receipt size={15} />} title="Order history" /><div>{CUSTOMER_HISTORY.map((o) => <div key={o.id} className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid var(--line)" }}><div><div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>Order #{o.id}</div><div className="text-[12px]" style={{ color: "var(--muted)" }}>{o.date} · {o.meals} meals</div></div><div className="flex items-center gap-2"><span className="disp text-[15px] font-medium" style={{ color: "var(--ink)" }}>{fmt(o.total)}</span><ChevronRight size={15} style={{ color: "#c4bca6" }} /></div></div>)}</div></Card>
  </div>);
}

/* =================================================================== */
/*  POS TERMINAL                                                        */
/* =================================================================== */

function POS({ meals, settings, onOrder }) {
  const [cart, setCart] = useState({});
  const [done, setDone] = useState(false);
  const add = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const sub = (id) => setCart((c) => { const n = (c[id] || 0) - 1; const x = { ...c }; if (n <= 0) delete x[id]; else x[id] = n; return x; });
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const subtotal = Object.entries(cart).reduce((s, [id, q]) => s + (findMeal(meals, id)?.price || 0) * q, 0);
  const tax = subtotal * (settings.taxRate / 100);
  const total = subtotal + tax;
  const complete = (method) => { onOrder({ customer: `Walk-in (${method})`, type: "pos", day: "Mon", items: { ...cart }, addr: "In-store", zone: "—" }); setDone(true); setTimeout(() => { setCart({}); setDone(false); }, 1800); };
  return (
    <Page>
      <Head kicker="In-store" title="POS Terminal" sub="Ring up walk-in and counter orders — no online checkout needed." />
      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="grid sm:grid-cols-3 gap-3">{meals.map((m) => (<button key={m.id} onClick={() => add(m.id)} className="rounded-xl border p-3 text-left transition-transform active:scale-[.98]" style={{ borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)" }}><div className="h-12 rounded-md mb-2.5 grid place-items-center" style={{ background: `${m.swatch}12` }}><PlateMark color={m.swatch} size={30} /></div><div className="text-[12.5px] font-semibold leading-snug" style={{ color: "var(--ink)" }}>{m.name}</div><div className="flex items-center justify-between mt-1"><span className="text-[11px]" style={{ color: "var(--muted)" }}>{m.diet}</span><span className="disp text-[14px] font-medium" style={{ color: "var(--pine)" }}>{fmt(m.price)}</span></div>{cart[m.id] > 0 && <div className="mt-1.5 text-[11px] font-medium" style={{ color: "var(--clay)" }}>In cart × {cart[m.id]}</div>}</button>))}</div>
        <aside className="lg:sticky lg:top-6 h-fit">
          <Card>
            <div className="flex items-center gap-2 mb-4"><Wallet size={16} style={{ color: "var(--pine)" }} /><h2 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Current sale</h2>{count > 0 && <span className="ml-auto text-[12.5px]" style={{ color: "var(--muted)" }}>{count} items</span>}</div>
            {count === 0 ? <p className="text-[13px] py-8 text-center" style={{ color: "var(--muted)" }}>Tap meals to add them.</p> : (<>
              <div className="space-y-1.5 mb-4 max-h-52 overflow-auto">{Object.entries(cart).map(([id, q]) => { const m = findMeal(meals, id); return m && <div key={id} className="flex items-center justify-between text-[13px]"><span className="truncate pr-2" style={{ color: "var(--ink)" }}>{m.name}</span><div className="flex items-center gap-2 shrink-0"><button onClick={() => sub(id)}><Minus size={14} style={{ color: "var(--muted)" }} /></button><span className="w-4 text-center font-semibold">{q}</span><button onClick={() => add(id)}><Plus size={14} style={{ color: "var(--muted)" }} /></button></div></div>; })}</div>
              <div className="space-y-1.5 text-[13px] py-3 border-t border-b mb-3" style={{ borderColor: "var(--line)" }}><Row l="Subtotal" v={fmt(subtotal)} /><Row l={`Tax (${settings.taxRate}%)`} v={fmt(tax)} /></div>
              <div className="flex justify-between items-baseline mb-4"><span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Total</span><span className="disp text-[24px] font-medium" style={{ color: "var(--pine)" }}>{fmt(total)}</span></div>
              {done ? <div className="w-full py-2.5 rounded-lg text-[13.5px] font-medium flex items-center justify-center gap-2" style={{ background: "#5e7350", color: "#f4f2ec" }}><Check size={17} /> Sale complete</div> : <div className="grid grid-cols-2 gap-2"><button onClick={() => complete("cash")} className="py-2.5 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5" style={{ background: "var(--sand)", color: "var(--ink)", border: "1px solid var(--line)" }}><Banknote size={15} /> Cash</button><button onClick={() => complete("card")} className="py-2.5 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5" style={btnPrimary}><CreditCard size={15} /> Card</button></div>}
            </>)}
          </Card>
        </aside>
      </div>
    </Page>
  );
}

/* =================================================================== */
/*  ORDERS                                                              */
/* =================================================================== */

function Orders({ meals, orders }) {
  const tagColor = (t) => t === "subscription" ? { bg: "color-mix(in srgb, var(--pine) 10%, transparent)", c: "var(--pine)" } : t === "pos" ? { bg: "color-mix(in srgb, var(--clay) 12%, transparent)", c: "var(--clay)" } : { bg: "var(--sand)", c: "var(--muted)" };
  return (
    <Page><Head kicker="Operations" title="Orders" sub="Every order for the current production period." />
      <Card className="!p-0 overflow-hidden">{orders.map((o, i) => { const tc = tagColor(o.type); return (
        <div key={o.id} className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: i ? "1px solid var(--line)" : "none" }}><div className="flex items-center gap-3.5"><span className="text-[12px] font-mono" style={{ color: "#b3ada0" }}>#{o.id}</span><div><div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>{o.customer}</div><div className="text-[12px]" style={{ color: "var(--muted)" }}>{orderCount(o)} meals · {o.day} {o.zone && o.zone !== "—" ? `· ${o.zone}` : ""}</div></div></div><div className="flex items-center gap-3"><span className="text-[11px] px-2 py-0.5 rounded font-medium capitalize" style={{ background: tc.bg, color: tc.c }}>{o.type === "pos" ? "In-store" : o.type === "subscription" ? "Subscription" : "One-time"}</span><span className="disp text-[15px] font-medium w-16 text-right" style={{ color: "var(--ink)" }}>{fmt(orderTotal(meals, o))}</span></div></div>); })}</Card>
    </Page>
  );
}

/* =================================================================== */
/*  KITCHEN OS                                                          */
/* =================================================================== */

function Kitchen({ meals, setMeals, orders }) {
  const [tab, setTab] = useState("menu");
  return (
    <Page>
      <Head kicker="Kitchen Management OS" title="Run the Kitchen" sub="Menu, production, live tickets, purchasing, labels and slips." right={["labels", "packing", "production", "shopping"].includes(tab) ? <PrintBtn /> : null} />
      <Tabs tabs={[["menu", "Menu", UtensilsCrossed], ["production", "Production", ClipboardList], ["kds", "Live Tickets", Monitor], ["shopping", "Shopping", Carrot], ["labels", "Labels", Tag], ["packing", "Packing", Printer]]} tab={tab} setTab={setTab} />
      {tab === "menu" && <MenuManager meals={meals} setMeals={setMeals} />}
      {tab === "production" && <Production meals={meals} orders={orders} />}
      {tab === "kds" && <KDS meals={meals} orders={orders} />}
      {tab === "shopping" && <Shopping meals={meals} orders={orders} />}
      {tab === "labels" && <Labels meals={meals} orders={orders} />}
      {tab === "packing" && <Packing meals={meals} orders={orders} />}
    </Page>
  );
}

const BLANK = { name: "", desc: "", diet: "High Protein", price: "", cal: "", protein: "", carbs: "", fat: "", allergens: [], ingredients: [{ name: "", qty: "", unit: "oz", trim: "" }] };
function MenuManager({ meals, setMeals }) {
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState(BLANK);
  const [toast, setToast] = useState("");
  const upd = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleAllergen = (a) => setF((s) => ({ ...s, allergens: s.allergens.includes(a) ? s.allergens.filter((x) => x !== a) : [...s.allergens, a] }));
  const updIng = (i, k, v) => setF((s) => { const ing = [...s.ingredients]; ing[i] = { ...ing[i], [k]: v }; return { ...s, ingredients: ing }; });
  const addIng = () => setF((s) => ({ ...s, ingredients: [...s.ingredients, { name: "", qty: "", unit: "oz", trim: "" }] }));
  const remIng = (i) => setF((s) => ({ ...s, ingredients: s.ingredients.filter((_, x) => x !== i) }));
  const save = () => { if (!f.name.trim() || !f.price) { setToast("Add a name and price to save."); setTimeout(() => setToast(""), 2500); return; } const meal = { id: "m" + Math.random().toString(36).slice(2, 7), name: f.name.trim(), desc: f.desc.trim(), diet: f.diet, price: parseFloat(f.price) || 0, swatch: SWATCHES[meals.length % SWATCHES.length], allergens: f.allergens, macros: { cal: +f.cal || 0, protein: +f.protein || 0, carbs: +f.carbs || 0, fat: +f.fat || 0 }, ingredients: f.ingredients.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), qty: parseFloat(i.qty) || 0, unit: i.unit, trim: (parseFloat(i.trim) || 0) / 100 })) }; setMeals((m) => [...m, meal]); setF(BLANK); setShowForm(false); setToast(`"${meal.name}" added to your menu.`); setTimeout(() => setToast(""), 3000); };
  const del = (id) => setMeals((m) => m.filter((x) => x.id !== id));
  return (<>
    {toast && <div className="fade mb-4 px-4 py-2.5 rounded-lg text-[13px] flex items-center gap-2" style={{ background: "color-mix(in srgb, var(--pine) 9%, transparent)", color: "var(--pine)", border: "1px solid color-mix(in srgb, var(--pine) 20%, transparent)" }}><Check size={15} />{toast}</div>}
    <div className="flex items-center justify-between mb-4"><span className="text-[13px]" style={{ color: "var(--muted)" }}>{meals.length} items on your menu</span><button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium" style={showForm ? { background: "var(--sand)", color: "var(--ink)" } : btnPrimary}>{showForm ? <><X size={15} /> Close</> : <><Plus size={15} /> Add menu item</>}</button></div>
    {showForm && (<Card className="mb-5 fade"><CardTitle icon={<UtensilsCrossed size={15} />} title="New menu item" note="Appears live in the storefront" />
      <div className="grid sm:grid-cols-2 gap-4"><Field label="Meal name"><input value={f.name} onChange={(e) => upd("name", e.target.value)} placeholder="BBQ Chicken Bowl" className={INP} /></Field><Field label="Price ($)"><input type="number" step="0.5" value={f.price} onChange={(e) => upd("price", e.target.value)} placeholder="12.50" className={INP} /></Field></div>
      <Field label="Short description" className="mt-4"><input value={f.desc} onChange={(e) => upd("desc", e.target.value)} placeholder="One line customers see on the card" className={INP} /></Field>
      <Field label="Diet category" className="mt-4"><div className="flex gap-1.5 flex-wrap">{DIET_OPTS.map((d) => <button key={d} onClick={() => upd("diet", d)} className="px-3 py-1.5 rounded-md text-[12.5px] border" style={{ background: f.diet === d ? "var(--ink)" : "transparent", color: f.diet === d ? "#f4f2ec" : "var(--ink-soft)", borderColor: f.diet === d ? "var(--ink)" : "var(--line)" }}>{d}</button>)}</div></Field>
      <div className="mt-4"><label className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>Nutrition (per meal)</label><div className="grid grid-cols-4 gap-3 mt-1.5">{[["cal", "Calories"], ["protein", "Protein g"], ["carbs", "Carbs g"], ["fat", "Fat g"]].map(([k, l]) => <div key={k}><input type="number" value={f[k]} onChange={(e) => upd(k, e.target.value)} placeholder="0" className={INP} /><div className="text-[11px] mt-1 text-center" style={{ color: "var(--muted)" }}>{l}</div></div>)}</div></div>
      <Field label="Allergens" className="mt-4"><div className="flex gap-1.5 flex-wrap">{ALLERGENS.map((a) => { const I = ALLERGEN_ICON[a]; const on = f.allergens.includes(a); return <button key={a} onClick={() => toggleAllergen(a)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] border capitalize" style={{ background: on ? "var(--clay)" : "transparent", color: on ? "#f4f2ec" : "var(--ink-soft)", borderColor: on ? "var(--clay)" : "var(--line)" }}><I size={13} />{a}</button>; })}</div></Field>
      <div className="mt-5"><label className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>Ingredients <span style={{ color: "var(--muted)" }}>— trim % powers the zero-waste shopping list</span></label><div className="space-y-2 mt-2">{f.ingredients.map((ing, i) => (<div key={i} className="grid grid-cols-[1fr_68px_78px_68px_auto] gap-2 items-center"><input value={ing.name} onChange={(e) => updIng(i, "name", e.target.value)} placeholder="Ingredient" className={INP} /><input type="number" value={ing.qty} onChange={(e) => updIng(i, "qty", e.target.value)} placeholder="Qty" className={INP} /><select value={ing.unit} onChange={(e) => updIng(i, "unit", e.target.value)} className={INP}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select><input type="number" value={ing.trim} onChange={(e) => updIng(i, "trim", e.target.value)} placeholder="Trim%" className={INP} /><button onClick={() => remIng(i)} className="grid place-items-center w-8 h-8 rounded-md" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}><Trash2 size={14} style={{ color: "var(--clay)" }} /></button></div>))}</div><button onClick={addIng} className="mt-2 flex items-center gap-1 text-[12.5px] font-medium" style={{ color: "var(--pine)" }}><Plus size={13} /> Add ingredient</button></div>
      <div className="flex gap-2.5 mt-6"><button onClick={save} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium" style={btnPrimary}><Check size={15} /> Save to menu</button><button onClick={() => { setF(BLANK); setShowForm(false); }} className="px-4 py-2.5 rounded-lg text-[13px] font-medium" style={{ background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" }}>Cancel</button></div>
    </Card>)}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">{meals.map((m) => (<div key={m.id} className="rounded-xl border overflow-hidden group" style={{ borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)" }}><div className="h-16 relative grid place-items-center" style={{ background: `${m.swatch}10` }}><PlateMark color={m.swatch} size={32} /><button onClick={() => del(m.id)} className="absolute top-2 right-2 grid place-items-center w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}><Trash2 size={12} style={{ color: "var(--clay)" }} /></button></div><div className="p-3.5"><div className="flex items-center justify-between gap-2"><span className="text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>{m.name}</span><span className="disp text-[14px] font-medium shrink-0" style={{ color: "var(--ink)" }}>{fmt(m.price)}</span></div><div className="text-[12px] mb-2" style={{ color: "var(--muted)" }}>{m.diet} · {m.macros.cal} cal</div><div className="flex flex-wrap gap-1">{m.ingredients.slice(0, 4).map((ing, k) => <span key={k} className="text-[10.5px] px-1.5 py-0.5 rounded" style={{ background: "var(--paper)", color: "var(--muted)", border: "1px solid var(--line)" }}>{ing.name}</span>)}</div></div></div>))}</div>
  </>);
}

function Production({ meals, orders }) {
  const groups = useMemo(() => {
    const map = {}; orders.forEach((o) => Object.entries(o.items).forEach(([id, q]) => { map[id] = (map[id] || 0) + q; }));
    const byStation = {};
    Object.entries(map).forEach(([id, q]) => { const m = findMeal(meals, id); if (!m) return; const st = STATION[m.diet] || "Other"; (byStation[st] = byStation[st] || []).push({ m, q }); });
    return byStation;
  }, [orders, meals]);
  const grand = Object.values(groups).flat().reduce((s, x) => s + x.q, 0);
  return (<div className="space-y-4">
    {Object.entries(groups).map(([station, items]) => (
      <Card key={station} className="!p-0 overflow-hidden print-full">
        <div className="flex items-center gap-2 px-5 py-2.5" style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)" }}><Layers size={14} style={{ color: "var(--pine)" }} /><span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink)" }}>{station}</span><span className="text-[12px]" style={{ color: "var(--muted)" }}>· {items.reduce((s, x) => s + x.q, 0)} meals</span></div>
        {items.sort((a, b) => b.q - a.q).map(({ m, q }, i) => (<div key={m.id} className="flex items-center justify-between px-5 py-3" style={{ borderTop: i ? "1px solid var(--line)" : "none" }}><div className="flex items-center gap-3"><div className="w-1.5 h-8 rounded-full" style={{ background: m.swatch }} /><div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>{m.name}</div></div><div className="disp text-[20px] font-medium" style={{ color: "var(--ink)" }}>{q}</div></div>))}
      </Card>
    ))}
    <div className="flex items-center justify-between px-5 py-3.5 rounded-xl" style={{ background: "var(--pine)", color: "#f4f2ec" }}><div className="text-[13.5px] font-semibold">Total meals to cook</div><div className="disp text-[22px] font-medium">{grand}</div></div>
  </div>);
}

function KDS({ meals, orders }) {
  const init = useMemo(() => orders.map((o, i) => ({ ...o, status: i < 2 ? "ready" : i < 4 ? "cooking" : "new" })), [orders]);
  const [tickets, setTickets] = useState(init);
  const move = (id, status) => setTickets((t) => t.map((x) => x.id === id ? { ...x, status } : x));
  const cols = [["new", "New", "var(--clay)"], ["cooking", "Cooking", "#b5841d"], ["ready", "Ready", "#5e7350"]];
  const next = { new: "cooking", cooking: "ready" };
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {cols.map(([key, label, color]) => (
        <div key={key}>
          <div className="flex items-center gap-2 mb-3"><span className="w-2 h-2 rounded-full" style={{ background: color }} /><span className="text-[12.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink)" }}>{label}</span><span className="text-[12px]" style={{ color: "var(--muted)" }}>{tickets.filter((t) => t.status === key).length}</span></div>
          <div className="space-y-3">{tickets.filter((t) => t.status === key).map((t) => (
            <div key={t.id} className="rounded-xl border p-3.5" style={{ borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)" }}>
              <div className="flex items-center justify-between mb-2"><span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>#{t.id}</span><span className="text-[11.5px]" style={{ color: "var(--muted)" }}>{t.customer}</span></div>
              <div className="space-y-1 mb-3">{Object.entries(t.items).map(([id, q]) => { const m = findMeal(meals, id); return m && <div key={id} className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--ink-soft)" }}><span className="font-semibold" style={{ color }}>{q}×</span> {m.name}</div>; })}</div>
              {next[t.status] ? <button onClick={() => move(t.id, next[t.status])} className="w-full py-1.5 rounded-md text-[12px] font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>Move to {next[t.status]}</button> : <button onClick={() => move(t.id, "cooking")} className="w-full py-1.5 rounded-md text-[12px] font-medium" style={{ background: "var(--sand)", color: "var(--muted)" }}>Reopen</button>}
            </div>))}
            {tickets.filter((t) => t.status === key).length === 0 && <div className="rounded-xl border border-dashed py-8 text-center text-[12px]" style={{ borderColor: "var(--line)", color: "#b3ada0" }}>No tickets</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Shopping({ meals, orders }) {
  const list = useMemo(() => { const map = {}; orders.forEach((o) => Object.entries(o.items).forEach(([id, q]) => { const m = findMeal(meals, id); if (m) m.ingredients.forEach((ing) => { if (ing.qty == null) return; const k = `${ing.name}|${ing.unit}|${ing.trim}`; map[k] = (map[k] || 0) + ing.qty * q; }); })); return Object.entries(map).map(([k, need]) => { const [name, unit, trim] = k.split("|"); const t = parseFloat(trim); return { name, unit, need, buy: need / (1 - t), trim: t }; }).sort((a, b) => a.name.localeCompare(b.name)); }, [orders, meals]);
  return (<>
    <div className="no-print rounded-xl border p-4 mb-4 flex items-center gap-3" style={{ borderColor: "var(--line)", background: "var(--surface)" }}><div className="grid place-items-center w-9 h-9 rounded-md shrink-0" style={{ background: "color-mix(in srgb, var(--pine) 10%, transparent)", color: "var(--pine)" }}><Sparkles size={16} /></div><p className="text-[12.5px] leading-snug" style={{ color: "var(--ink-soft)" }}><span style={{ color: "var(--ink)", fontWeight: 600 }}>Trim-aware purchasing.</span> The purchase column accounts for prep waste on every ingredient, so you buy what you need — no overbuying.</p></div>
    <Card className="!p-0 overflow-hidden print-full"><div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider" style={{ background: "var(--paper)", color: "var(--muted)" }}><span>Ingredient</span><span className="text-right">In meals</span><span className="text-right">Trim</span><span className="text-right">Purchase</span></div>{list.map((ing) => <div key={ing.name} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 items-center text-[13px]" style={{ borderTop: "1px solid var(--line)" }}><span style={{ color: "var(--ink)" }}>{ing.name}</span><span className="text-right" style={{ color: "var(--muted)" }}>{round(ing.need)} {ing.unit}</span><span className="text-right text-[12px]" style={{ color: "var(--clay)" }}>{ing.trim > 0 ? `${Math.round(ing.trim * 100)}%` : "—"}</span><span className="text-right disp text-[14px] font-medium" style={{ color: "var(--ink)" }}>{round(ing.buy)} {ing.unit}</span></div>)}</Card>
  </>);
}

function Labels({ meals, orders }) {
  const ml = useMemo(() => { const map = {}; orders.forEach((o) => Object.entries(o.items).forEach(([id, q]) => { map[id] = (map[id] || 0) + q; })); return Object.entries(map).filter(([id]) => findMeal(meals, id)); }, [orders, meals]);
  return (<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 print-full">{ml.map(([id, q]) => { const m = findMeal(meals, id); return (<div key={id} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--surface)" }}><div className="px-4 py-2.5 flex items-center justify-between" style={{ background: m.swatch }}><span className="text-[13px] font-semibold text-[#f4f2ec] truncate">{m.name}</span><span className="text-[11px] text-[#f4f2ec]/85 shrink-0">×{q}</span></div><div className="p-4"><div className="grid grid-cols-4 gap-1 mb-3 text-center">{[["Cal", m.macros.cal], ["P", m.macros.protein], ["C", m.macros.carbs], ["F", m.macros.fat]].map(([k, v]) => <div key={k}><div className="text-[10px]" style={{ color: "var(--muted)" }}>{k}</div><div className="text-[12.5px] font-semibold" style={{ color: "var(--ink)" }}>{v}</div></div>)}</div><div className="text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}><div><span style={{ color: "var(--ink)", fontWeight: 600 }}>Ingredients:</span> {m.ingredients.map((x) => x.name).join(", ") || "—"}</div><div className="mt-1"><span style={{ color: "var(--ink)", fontWeight: 600 }}>Allergens:</span> {m.allergens.length ? m.allergens.join(", ") : "None"}</div><div className="mt-1"><span style={{ color: "var(--ink)", fontWeight: 600 }}>Best by:</span> 4 days · Keep refrigerated</div></div></div></div>); })}</div>);
}

function Packing({ meals, orders }) {
  const [sel, setSel] = useState(orders[0]?.id);
  const order = orders.find((o) => o.id === sel) || orders[0];
  return (<div className="grid lg:grid-cols-[196px_1fr] gap-4"><div className="no-print space-y-1.5">{orders.map((o) => <button key={o.id} onClick={() => setSel(o.id)} className="w-full text-left px-3.5 py-2.5 rounded-lg text-[13px] border transition-colors" style={{ background: sel === o.id ? "var(--ink)" : "var(--surface)", color: sel === o.id ? "#f4f2ec" : "var(--ink)", borderColor: sel === o.id ? "var(--ink)" : "var(--line)" }}><div className="font-medium">{o.customer}</div><div className="text-[11px] opacity-70">#{o.id}</div></button>)}</div>{order && (<div className="rounded-xl border p-7 print-full" style={{ borderColor: "var(--line)", background: "var(--surface)" }}><div className="flex items-center justify-between pb-4" style={{ borderBottom: "1px solid var(--line)" }}><div className="flex items-center gap-2"><div className="grid place-items-center w-7 h-7 rounded-md" style={{ background: "var(--pine)" }}><Leaf size={15} color="#f4f2ec" /></div><span className="disp text-[18px] font-medium" style={{ color: "var(--ink)" }}>Greenleaf Kitchen</span></div><div className="text-right text-[12px]" style={{ color: "var(--muted)" }}><div>Order #{order.id}</div><div>{order.day} delivery</div></div></div><div className="py-4"><div className="text-[11.5px] mb-0.5 uppercase tracking-wide" style={{ color: "var(--muted)" }}>Prepared for</div><div className="disp text-[17px] font-medium" style={{ color: "var(--ink)" }}>{order.customer}</div></div><table className="w-full text-[13px]"><thead><tr style={{ color: "var(--muted)" }} className="text-left text-[11px] uppercase tracking-wide"><th className="font-semibold pb-2">Qty</th><th className="font-semibold pb-2">Meal</th><th className="font-semibold pb-2 text-right">Calories</th></tr></thead><tbody>{Object.entries(order.items).map(([id, q]) => { const m = findMeal(meals, id); return m && <tr key={id} style={{ borderTop: "1px solid var(--line)", color: "var(--ink)" }}><td className="py-2.5 font-semibold" style={{ color: "var(--pine)" }}>{q}×</td><td className="py-2.5">{m.name}</td><td className="py-2.5 text-right" style={{ color: "var(--muted)" }}>{m.macros.cal} cal</td></tr>; })}</tbody></table><div className="mt-5 p-3 rounded-lg text-[12px]" style={{ background: "var(--paper)", color: "var(--muted)" }}><span style={{ color: "var(--ink)", fontWeight: 600 }}>Heating:</span> Microwave 2–3 min or oven 350°F for 12 min. Best within 4 days.</div></div>)}</div>);
}
function PrintBtn() { return <button onClick={() => window.print()} className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium" style={btnPrimary}><Printer size={14} /> Print</button>; }

/* =================================================================== */
/*  DELIVERY ROUTES                                                     */
/* =================================================================== */

function Routes({ orders }) {
  const deliveries = orders.filter((o) => o.zone && o.zone !== "—" && o.addr && o.addr !== "In-store");
  const [optimized, setOptimized] = useState(false);
  const ordered = useMemo(() => { if (!optimized) return deliveries; const zoneRank = { North: 0, East: 1, West: 2 }; return [...deliveries].sort((a, b) => (zoneRank[a.zone] - zoneRank[b.zone]) || a.id - b.id); }, [optimized, deliveries]);
  const startMin = 8 * 60;
  const eta = (i) => { const t = startMin + i * 18; const h = Math.floor(t / 60); const m = t % 60; const ap = h >= 12 ? "PM" : "AM"; const hh = ((h + 11) % 12) + 1; return `${hh}:${String(m).padStart(2, "0")} ${ap}`; };
  const zoneColor = { North: "#5e6b4a", East: "#3f5c5a", West: "#8a5a3c" };
  return (
    <Page>
      <Head kicker="Logistics" title="Delivery Routes" sub="Sequence Monday's deliveries into an efficient driver run." right={<button onClick={() => setOptimized((o) => !o)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium" style={optimized ? { background: "var(--sand)", color: "var(--ink)", border: "1px solid var(--line)" } : btnPrimary}><Navigation size={15} />{optimized ? "Reset order" : "Optimize route"}</button>} />
      <div className="grid sm:grid-cols-3 gap-3.5 mb-5"><Kpi icon={<Truck size={16} />} label="Stops" value={ordered.length} /><Kpi icon={<MapPin size={16} />} label="Zones" value={new Set(ordered.map((o) => o.zone)).size} /><Kpi icon={<Clock size={16} />} label="Est. finish" value={eta(ordered.length)} /></div>
      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <Card className="!p-0 overflow-hidden">
          {ordered.map((o, i) => (<div key={o.id} className="flex items-center gap-4 px-5 py-3.5" style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
            <div className="grid place-items-center w-7 h-7 rounded-full text-[12px] font-semibold shrink-0" style={{ background: "var(--pine)", color: "#f4f2ec" }}>{i + 1}</div>
            <div className="flex-1 min-w-0"><div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>{o.customer}</div><div className="text-[12px] flex items-center gap-1" style={{ color: "var(--muted)" }}><MapPin size={11} />{o.addr}</div></div>
            <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{ background: `${zoneColor[o.zone]}1a`, color: zoneColor[o.zone] }}>{o.zone}</span>
            <div className="text-right shrink-0"><div className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{eta(i)}</div><div className="text-[11px]" style={{ color: "var(--muted)" }}>{orderCount(o)} meals</div></div>
          </div>))}
        </Card>
        <Card>
          <div className="text-[12.5px] font-semibold mb-3" style={{ color: "var(--ink)" }}>Route map</div>
          <svg viewBox="0 0 200 240" className="w-full">
            <rect x="0" y="0" width="200" height="240" rx="10" fill="var(--paper)" />
            {ordered.map((o, i) => { const x = 30 + (i % 2) * 120 + (i % 3) * 10; const y = 28 + i * 34; return ordered[i + 1] ? <line key={"l" + i} x1={x} y1={y} x2={30 + ((i + 1) % 2) * 120 + ((i + 1) % 3) * 10} y2={28 + (i + 1) * 34} stroke="var(--pine)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" /> : null; })}
            {ordered.map((o, i) => { const x = 30 + (i % 2) * 120 + (i % 3) * 10; const y = 28 + i * 34; return <g key={o.id}><circle cx={x} cy={y} r="9" fill={zoneColor[o.zone]} /><text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fill="#f4f2ec" fontWeight="600">{i + 1}</text></g>; })}
          </svg>
          <p className="text-[11.5px] mt-2 leading-snug" style={{ color: "var(--muted)" }}>{optimized ? "Optimized: stops grouped by zone to cut drive time." : "Tap Optimize to group stops by delivery zone."}</p>
        </Card>
      </div>
    </Page>
  );
}

/* =================================================================== */
/*  MARKETING (+ gift cards)                                            */
/* =================================================================== */

function Marketing({ giftCards, setGiftCards }) {
  const [tab, setTab] = useState("campaigns");
  return (<Page>
    <Head kicker="Marketing Hub" title="Grow the Business" sub="Loyalty, referrals, SMS and gift cards — built in, not bolted on." />
    <Tabs tabs={[["campaigns", "Campaigns", Megaphone], ["gift", "Gift Cards", Gift]]} tab={tab} setTab={setTab} />
    {tab === "campaigns" && <Campaigns />}
    {tab === "gift" && <GiftCards giftCards={giftCards} setGiftCards={setGiftCards} />}
  </Page>);
}
function Campaigns() {
  const [sms, setSms] = useState("Fresh menu drops tonight. Order by 8pm for Monday delivery — use FRESH10 for 10% off.");
  const [sent, setSent] = useState(false);
  return (<>
    <div className="grid sm:grid-cols-3 gap-3.5 mb-4"><Kpi icon={<Users size={16} />} label="Active members" value="218" delta="+24" /><Kpi icon={<Gift size={16} />} label="Referrals (mo)" value="37" delta="+11" /><Kpi icon={<Star size={16} />} label="Points redeemed" value="9,400" delta="+1.2k" /></div>
    <div className="grid lg:grid-cols-2 gap-4 mb-4">
      <Card><CardTitle icon={<Star size={15} />} title="Loyalty program" note="Active" /><div className="space-y-2.5">{[["Earn 1 point per $1 spent", "On every order, automatically"], ["100 pts = $5 reward", "Auto-applied at checkout"], ["Double points Tuesdays", "Drives mid-week volume"]].map(([t, d], i) => <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}><div className="grid place-items-center w-6 h-6 rounded-md shrink-0 mt-0.5" style={{ background: "var(--pine)" }}><Check size={13} color="#f4f2ec" /></div><div><div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{t}</div><div className="text-[12px]" style={{ color: "var(--muted)" }}>{d}</div></div></div>)}</div></Card>
      <Card><CardTitle icon={<Gift size={15} />} title="Referral program" note="Give $10, get $10" /><div className="rounded-lg p-5 mb-3 text-center" style={{ background: "var(--pine)" }}><div className="text-[12px] mb-1" style={{ color: "#ffffffaa" }}>Maria's referral link</div><div className="disp text-[17px] font-medium text-[#f4f2ec]">greenleaf.co/r/MARIA10</div><div className="text-[12px] mt-2" style={{ color: "#ffffffaa" }}>4 friends joined · $40 earned</div></div><div className="grid grid-cols-2 gap-2.5 text-center">{[["Sent", "62"], ["Converted", "37"]].map(([l, v]) => <div key={l} className="rounded-lg py-3" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}><div className="disp text-[18px] font-medium" style={{ color: "var(--ink)" }}>{v}</div><div className="text-[12px]" style={{ color: "var(--muted)" }}>{l}</div></div>)}</div></Card>
    </div>
    <Card><CardTitle icon={<MessageSquare size={15} />} title="SMS campaign" note="Reaches 218 subscribers" /><div className="grid md:grid-cols-[1fr_210px] gap-5 items-start"><div><textarea value={sms} onChange={(e) => setSms(e.target.value)} rows={4} className="w-full p-3 rounded-lg border text-[13px] outline-none resize-none" style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }} /><div className="flex items-center justify-between mt-2"><span className="text-[12px]" style={{ color: "var(--muted)" }}>{sms.length}/160 chars</span><button onClick={() => { setSent(true); setTimeout(() => setSent(false), 2200); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium" style={sent ? { background: "#5e7350", color: "#f4f2ec" } : btnPrimary}>{sent ? <><Check size={14} /> Sent to 218</> : <><Send size={14} /> Send campaign</>}</button></div></div><div className="rounded-lg border p-3" style={{ borderColor: "var(--line)", background: "var(--paper)" }}><div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>Preview</div><div className="rounded-xl rounded-tl-sm p-3 text-[12px] leading-snug" style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)" }}>{sms}</div></div></div></Card>
  </>);
}
function GiftCards({ giftCards, setGiftCards }) {
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const issue = () => { const amt = parseFloat(amount); if (!amt || !email.trim()) return; const code = "GIFT-" + Math.random().toString(36).slice(2, 6).toUpperCase(); setGiftCards((g) => [{ code, amount: amt, balance: amt, recipient: email.trim() }, ...g]); setAmount(""); setEmail(""); };
  const outstanding = giftCards.reduce((s, g) => s + g.balance, 0);
  return (<div className="grid lg:grid-cols-[300px_1fr] gap-4">
    <Card>
      <CardTitle icon={<Gift size={15} />} title="Issue a gift card" />
      <Field label="Amount ($)"><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50" className={INP} /></Field>
      <Field label="Recipient email" className="mt-3"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@email.com" className={INP} /></Field>
      <button onClick={issue} className="mt-4 w-full py-2.5 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5" style={btnPrimary}><Send size={14} /> Issue & email code</button>
      <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--line)" }}><span className="text-[12.5px]" style={{ color: "var(--muted)" }}>Outstanding balance</span><span className="disp text-[18px] font-medium" style={{ color: "var(--ink)" }}>{fmt(outstanding)}</span></div>
    </Card>
    <Card className="!p-0 overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider" style={{ background: "var(--paper)", color: "var(--muted)" }}><span>Code / recipient</span><span className="text-right">Balance</span><span className="text-right">Issued</span></div>
      {giftCards.map((g) => (<div key={g.code} className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3 items-center text-[13px]" style={{ borderTop: "1px solid var(--line)" }}><div><div className="font-mono font-medium" style={{ color: "var(--ink)" }}>{g.code}</div><div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{g.recipient}</div></div><div className="text-right"><span className="disp text-[15px] font-medium" style={{ color: g.balance > 0 ? "var(--pine)" : "var(--muted)" }}>{fmt(g.balance)}</span><div className="h-1 w-16 rounded-full overflow-hidden mt-1 ml-auto" style={{ background: "var(--sand)" }}><div className="h-full" style={{ width: `${(g.balance / g.amount) * 100}%`, background: "var(--pine)" }} /></div></div><span className="text-right text-[12px]" style={{ color: "var(--muted)" }}>{fmt(g.amount)}</span></div>))}
    </Card>
  </div>);
}

/* =================================================================== */
/*  STAFF                                                               */
/* =================================================================== */

function Staff() {
  const [published, setPublished] = useState(false);
  const hours = (s) => { if (s === "off") return 0; const [a, b] = s.split("–"); const p = (x) => { const m = x.match(/(\d+)(\d{2})?([ap])/); let h = +m[1]; if (m[3] === "p" && h !== 12) h += 12; return h + (m[2] ? +m[2] / 60 : 0); }; return p(b) - p(a); };
  const weekHours = (i) => SHIFTS[i].reduce((s, sh) => s + hours(sh), 0);
  const laborCost = STAFF.reduce((s, e, i) => s + weekHours(i) * e.rate, 0);
  const totalHours = STAFF.reduce((s, e, i) => s + weekHours(i), 0);
  return (
    <Page>
      <Head kicker="Sprwt HR" title="Staff & Scheduling" sub="Shifts, timesheets, and labor cost in one view." right={<button onClick={() => setPublished(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium" style={published ? { background: "#5e7350", color: "#f4f2ec" } : btnPrimary}>{published ? <><Check size={15} /> Published</> : <><Calendar size={15} /> Publish schedule</>}</button>} />
      <div className="grid sm:grid-cols-3 gap-3.5 mb-5"><Kpi icon={<Users size={16} />} label="Team members" value={STAFF.length} /><Kpi icon={<Clock size={16} />} label="Scheduled hours" value={`${totalHours.toFixed(0)}h`} /><Kpi icon={<Wallet size={16} />} label="Est. weekly labor" value={fmt0(laborCost)} /></div>
      <Card className="!p-0 overflow-hidden">
        <div className="grid px-4 py-2.5" style={{ gridTemplateColumns: "150px repeat(6, 1fr) 70px", background: "var(--paper)", borderBottom: "1px solid var(--line)" }}><span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Employee</span>{DAYS.map((d) => <span key={d} className="text-[11px] font-semibold uppercase tracking-wide text-center" style={{ color: "var(--muted)" }}>{d}</span>)}<span className="text-[11px] font-semibold uppercase tracking-wide text-right" style={{ color: "var(--muted)" }}>Hrs</span></div>
        {STAFF.map((e, i) => (<div key={e.name} className="grid items-center px-4 py-3" style={{ gridTemplateColumns: "150px repeat(6, 1fr) 70px", borderTop: i ? "1px solid var(--line)" : "none" }}>
          <div><div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{e.name.trim()}</div><div className="text-[11px]" style={{ color: "var(--muted)" }}>{e.role} · ${e.rate}/h</div></div>
          {SHIFTS[i].map((sh, j) => <div key={j} className="text-center px-1">{sh === "off" ? <span className="text-[11px]" style={{ color: "#c4bca6" }}>—</span> : <span className="text-[11px] px-1.5 py-1 rounded inline-block" style={{ background: "color-mix(in srgb, var(--pine) 9%, transparent)", color: "var(--pine)" }}>{sh}</span>}</div>)}
          <div className="text-right disp text-[14px] font-medium" style={{ color: "var(--ink)" }}>{weekHours(i).toFixed(0)}</div>
        </div>))}
      </Card>
    </Page>
  );
}

/* =================================================================== */
/*  SETTINGS (expanded)                                                 */
/* =================================================================== */

function SettingsPage({ settings, setSettings }) {
  const upd = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const colors = ["#2f4536", "#3f5c5a", "#5e4632", "#4a4458", "#6b4a3a", "#26302c"];
  const [loc, setLoc] = useState("");
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <Page>
      <Head kicker="Settings" title="Store Configuration" sub="These settings drive the storefront, checkout, and fulfillment." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardTitle icon={<Sparkles size={15} />} title="Branding" />
          <label className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>Brand color</label>
          <div className="flex gap-2.5 mt-2 mb-1">{colors.map((c) => <button key={c} onClick={() => upd("brand", c)} className="w-9 h-9 rounded-full" style={{ background: c, outline: settings.brand === c ? "2px solid var(--ink)" : "1px solid var(--line)", outlineOffset: 2 }} />)}</div>
        </Card>
        <Card>
          <CardTitle icon={<Wallet size={15} />} title="Pricing & fees" />
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Subscription discount (%)" v={settings.subDiscount} on={(v) => upd("subDiscount", v)} />
            <NumField label="Sales tax (%)" v={settings.taxRate} on={(v) => upd("taxRate", v)} />
            <NumField label="Delivery fee ($)" v={settings.deliveryFee} on={(v) => upd("deliveryFee", v)} step={0.5} />
            <NumField label="Processing fee ($)" v={settings.processingFee} on={(v) => upd("processingFee", v)} step={0.5} />
            <NumField label="Minimum order ($)" v={settings.minOrder} on={(v) => upd("minOrder", v)} />
            <NumField label="Min meals / order" v={settings.minMeals} on={(v) => upd("minMeals", v)} />
          </div>
        </Card>
        <Card>
          <CardTitle icon={<CalendarDays size={15} />} title="Fulfillment" />
          <label className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>Delivery days</label>
          <div className="flex gap-1.5 mt-2 mb-4 flex-wrap">{days.map((d) => { const on = settings.deliveryDays[d]; return <button key={d} onClick={() => upd("deliveryDays", { ...settings.deliveryDays, [d]: !on })} className="px-2.5 py-1.5 rounded-md text-[12px] font-medium border" style={{ background: on ? "var(--pine)" : "transparent", color: on ? "#f4f2ec" : "var(--muted)", borderColor: on ? "var(--pine)" : "var(--line)" }}>{d}</button>; })}</div>
          <label className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>Order cut-off</label>
          <input value={settings.cutoff} onChange={(e) => upd("cutoff", e.target.value)} className={`${INP} mt-1.5 mb-4`} />
          <label className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>Fulfillment type</label>
          <div className="flex gap-1.5 mt-2">{["delivery", "pickup", "both"].map((t) => <button key={t} onClick={() => upd("fulfillment", t)} className="px-3 py-1.5 rounded-md text-[12.5px] border capitalize" style={{ background: settings.fulfillment === t ? "var(--ink)" : "transparent", color: settings.fulfillment === t ? "#f4f2ec" : "var(--ink-soft)", borderColor: settings.fulfillment === t ? "var(--ink)" : "var(--line)" }}>{t}</button>)}</div>
        </Card>
        <Card>
          <CardTitle icon={<MapPin size={15} />} title="Pickup locations" />
          <div className="space-y-2 mb-3">{settings.pickupLocations.map((l, i) => (<div key={i} className="flex items-center justify-between px-3 py-2 rounded-md" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}><span className="text-[13px]" style={{ color: "var(--ink)" }}>{l}</span><button onClick={() => upd("pickupLocations", settings.pickupLocations.filter((_, x) => x !== i))}><Trash2 size={14} style={{ color: "var(--clay)" }} /></button></div>))}{settings.pickupLocations.length === 0 && <p className="text-[12px]" style={{ color: "var(--muted)" }}>No pickup locations yet.</p>}</div>
          <div className="flex gap-2"><input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Add a location" className={INP} /><button onClick={() => { if (loc.trim()) { upd("pickupLocations", [...settings.pickupLocations, loc.trim()]); setLoc(""); } }} className="px-3 rounded-md text-[13px] font-medium" style={btnPrimary}><Plus size={15} /></button></div>
        </Card>
      </div>
      <p className="text-[12px] mt-4" style={{ color: "var(--muted)" }}>Changes here flow straight into the Storefront — try lowering the minimum order or changing the subscription discount, then open Storefront.</p>
    </Page>
  );
}
function NumField({ label, v, on, step = 1 }) { return <div><label className="text-[11.5px] font-medium block mb-1" style={{ color: "var(--ink-soft)" }}>{label}</label><input type="number" step={step} value={v} onChange={(e) => on(parseFloat(e.target.value) || 0)} className={INP} /></div>; }
