// In-app operator's guide content — the same material as the printed
// PrepFlow Operator's Manual, structured for the /dashboard/guide page.
// Plain data only (no JSX) so it's easy to search, edit, and re-render.

export type GuideNumber = [term: string, definition: string];

export type GuideSection = {
  id: string; // anchor slug
  title: string;
  where: string; // breadcrumb, e.g. "Overview → Dashboard"
  does: string; // "What it does"
  use?: string[]; // "How you use it" steps
  img?: string; // filename under /public/guide
  numbers?: GuideNumber[]; // "What every number means"
  tips?: string[]; // "Good to know"
};

export type GuideArea = {
  label: string;
  blurb: string;
  sections: GuideSection[];
};

// A plain-English intro shown at the top of the guide.
export const GUIDE_INTRO = {
  bigIdea: {
    title: "Everything flows from two things: your ORDERS and your RECIPES.",
    points: [
      "Every order — from the storefront, the POS, or a subscription — automatically feeds your revenue, your production list, your shopping list, your labels, and your customer records. You enter an order once (or the customer does) and it shows up everywhere.",
      "Every recipe — the ingredients in a meal and what they cost — powers the money features: plate cost, margin, the trim-aware shopping list, and waste. If you don't enter a meal's recipe, that meal shows $0 cost and 100% margin, and its waste books $0. So: enter your recipes, and the numbers become real.",
    ],
  },
  glossary: [
    ["Plate cost", "What one meal costs you to make — the sum of its ingredients (trimmed for waste)."],
    ["Margin", "Your price minus the plate cost. In dollars, or as a % of the price."],
    ["Contribution", "Margin × how many you sold — the total profit a meal brought in."],
    ["COGS", "'Cost of goods sold' — the ingredient cost of the food you sold."],
    ["Trim %", "The share of an ingredient lost in prep (peels, fat, ends). Drives the 'over-bought' waste number."],
    ["Over-bought", "Dollars of ingredient you buy only to trim away and throw out."],
    ["One-time vs Subscription", "A single order vs a repeating weekly/bi-weekly plan."],
    ["Platform fee", "The small % PrepFlow takes on each customer payment (separate from your monthly software fee)."],
    ["Cut-off", "The weekly deadline after which orders lock for the kitchen."],
  ] as GuideNumber[],
};

export const GUIDE: GuideArea[] = [
  {
    label: "Overview",
    blurb: "How the business is doing.",
    sections: [
      {
        id: "dashboard",
        title: "Dashboard",
        where: "Overview → Dashboard",
        img: "01-dashboard.png",
        does:
          "Your home screen — a 10-second health check of the whole business. Pick a time window (Today / This Week / This Month / All time) with the buttons in the top-right and every number updates to that window.",
        use: [
          "Log in — this is the first thing you see.",
          "Use the time buttons (top-right) to switch between Today, This Week, This Month, and All time.",
          "Glance at the four numbers to know how business is going.",
        ],
        numbers: [
          ["Revenue (period)", "Total money from PAID orders in the window you picked. Cancelled and refunded orders are NOT counted (that money was never really earned)."],
          ["Meals ordered", "How many individual meals were ordered in the window (a 5-meal order counts as 5)."],
          ["Active subscriptions", "How many customers are currently on a repeating weekly/bi-weekly plan right now."],
          ["Avg order value", "Revenue ÷ number of orders — the average amount a customer spends per order."],
          ["Plan usage", "How many orders you've taken this month vs. how many your PrepFlow plan includes. The bar fills as you approach the limit."],
        ],
        tips: ["Everything here is calculated automatically from real orders — nothing is typed in by hand. If a number looks off, it's a reflection of the orders, not a bug."],
      },
      {
        id: "analytics",
        title: "Analytics",
        where: "Overview → Analytics",
        img: "02-analytics.png",
        does: "A deeper look at sales — what's selling best, how customers buy, and which delivery areas make the most money. Same time-window buttons as the Dashboard.",
        numbers: [
          ["Total revenue", "Money from paid orders in the window."],
          ["Avg order value", "Average spend per order (revenue ÷ orders)."],
          ["Active subscribers", "Customers on a recurring plan right now."],
          ["Customers", "How many unique customers ordered."],
          ["Top meals (by revenue)", "Your best-sellers, ranked. Each shows units sold and the revenue it brought in. The green bar shows how it compares to the top meal."],
          ["Order mix (by type)", "The split between one-time orders and subscription orders, as a percentage. Tells you how much of your business is repeat/recurring."],
          ["Revenue by zone", "How much money came from each delivery area (e.g. North, East, West). Shows you where demand is concentrated."],
        ],
        tips: ["Use this to decide what to promote (push the Top meals), and where to focus delivery or marketing (the strongest zones)."],
      },
      {
        id: "profitability",
        title: "Profitability & P&L",
        where: "Overview → Profitability",
        img: "03-profitability.png",
        does: "The most important money screen. It costs every meal from its recipe, shows the profit on each one, and gives you a true bottom line after waste. This is where you find out which meals actually make money.",
        numbers: [
          ["Food revenue (menu sales)", "Total money your meals brought in for the period."],
          ["Food cost (COGS)", "What those meals cost you to make (the ingredients). COGS = 'cost of goods sold'."],
          ["Gross margin", "Food revenue minus food cost — your profit on the food before waste and before overheads (labour, rent, packaging)."],
          ["Recorded food loss", "The cost of food you logged as wasted in Waste & Loss (spoilage, dropped orders, remakes)."],
          ["Net contribution", "Gross margin minus food loss — the real money the food left you, before labour/rent/fees."],
          ["Prime Cost %", "Food + labour as a share of sales — the single most-watched number in a food business. At or under 55% is healthy; above it, profit is very hard. Appears at the top once you enter labour in Operating Costs."],
          ["Labour / Overhead", "Your monthly labour and overhead (from Operating Costs), prorated to the period and subtracted just below Net contribution."],
          ["True operating profit", "Net contribution minus labour and overhead — what's really left before platform fees and income tax. Your actual bottom line."],
          ["What each plate really nets", "A second table that loads every meal with its share of labour and overhead too — so you see the real profit per plate, not just the food margin."],
          ["Avg margin %", "On average, what share of a meal's price is profit."],
          ["Avg food cost %", "On average, what share of a meal's price goes to ingredients."],
          ["Menu contribution (pre-loss)", "Total profit from the menu before waste is subtracted."],
          ["Money-losing meals", "How many meals cost more to make than you charge — fix these first."],
          ["Per-meal — Price", "What you charge for the meal."],
          ["Per-meal — Cost", "What its ingredients cost you (its 'plate cost')."],
          ["Per-meal — Margin", "Price minus cost, in dollars, per meal."],
          ["Per-meal — Margin %", "That profit as a percentage of the price."],
          ["Per-meal — Sold", "How many you sold in the period."],
          ["Per-meal — Contribution", "Margin × units sold — total profit that meal contributed."],
        ],
        tips: [
          "The colored badges are Menu Engineering — a classic restaurant tool. Each meal is one of four types:",
          "★ Star — high margin AND popular. Promote and protect it.",
          "Plowhorse — popular but thin margin. Re-price it or lower its cost.",
          "Puzzle — high margin but low sales. Feature it more — it makes good money when it sells.",
          "Dog — low margin and low sales. Fix it or cut it.",
          "Important: these numbers are only as good as your recipes. A meal with no ingredients entered shows '—' for cost until you add its recipe (in Menu) — so cost every meal for accurate figures.",
          "To unlock Prime Cost %, True operating profit, and the real per-plate profit, enter your labour and overhead in Operating Costs (Overview → Operating Costs). Until you do, this screen shows food-only profit and points you there.",
        ],
      },
      {
        id: "operating-costs",
        title: "Operating Costs (labour & overhead)",
        where: "Overview → Operating Costs",
        img: "operating-costs.png",
        does:
          "Where you tell PrepFlow the OTHER half of what it costs to run your kitchen. It already knows your food cost from recipes; here you add your monthly labour (wages) and overhead (rent, utilities, insurance, marketing, supplies). Once these are in, the Profitability screen can show your Prime Cost and your true profit after everything — not just the profit on the food.",
        use: [
          "Open Operating Costs (Overview → Operating Costs).",
          "In 'Add an operating cost', type a name (e.g. 'Kitchen wages', 'Rent'), pick Labour or Overhead, enter the amount PER MONTH, and press Add.",
          "Add a line for each real monthly cost — all your wages under Labour; rent, utilities, insurance, marketing and supplies under Overhead.",
          "Change an amount any time by editing the box and pressing Save; remove a line with the trash icon.",
          "Then open Profitability to see your Prime Cost % and True operating profit.",
        ],
        numbers: [
          ["Labour", "Everything you pay people to make and pack the food — wages, payroll taxes, and benefits. Enter it as a monthly total."],
          ["Overhead", "Your fixed monthly bills — rent, utilities, insurance, software, marketing, packaging and supplies."],
          ["Amount / month", "Always enter the MONTHLY figure. PrepFlow automatically prorates it to whatever time window you're viewing on Profitability (a week shows about a quarter of the month, and so on)."],
          ["% of sales", "Shown next to each line and each total — that cost as a share of this month's sales, so you can see, say, that labour is 30% of sales."],
        ],
        tips: [
          "You don't need exact numbers to start — a good estimate of monthly wages and rent already makes Prime Cost and true profit far more honest than food-cost-only.",
          "Prime Cost = food cost + labour. The restaurant rule of thumb is to keep it at or under 55% of sales; above that, it's very hard to make money. Profitability flags this for you in green or red.",
          "These figures are private to your kitchen and are never shown to customers.",
        ],
      },
      {
        id: "reports",
        title: "Reports",
        where: "Overview → Reports",
        img: "04-reports.png",
        does: "Printable/PDF summaries of your business — sales and meal performance over a date range — with your kitchen name and dates on them. Good for your accountant, a partner, or your own records.",
        use: ["Open Reports.", "Pick the report (e.g. Sales, Meals) and a date range.", "Download or print the PDF."],
        tips: ["Reports are just a clean, shareable version of the numbers you see live in Dashboard/Analytics — nothing new to learn, just formatted for printing."],
      },
    ],
  },
  {
    label: "Sales",
    blurb: "Your menu and customers.",
    sections: [
      {
        id: "menu",
        title: "Menu",
        where: "Sales → Menu",
        img: "05-menu.png",
        does: "Your list of meals — this is what customers see on your storefront. Add, edit, price, and turn meals on/off here. Each meal can also carry a recipe (ingredients), which powers the cost and margin features.",
        use: [
          "Menu → New menu item.",
          "Enter the name and the price (what a customer pays).",
          "(Recommended) Add a photo — it's the #1 thing that sells a meal on your storefront.",
          "Add a description, diet tag, calories/macros, and allergens if you have them.",
          "(Recommended) Add the recipe — the ingredients and how much of each — so PrepFlow can cost the meal.",
          "Save. It appears on your storefront instantly.",
        ],
        numbers: [
          ["Price", "What the customer pays for this meal."],
          ["Photo", "The meal's picture, shown large on your storefront. Optional, but the single biggest driver of orders — customers buy food with their eyes. Upload a landscape or square photo (at least 1000px wide; JPG, PNG, or WebP). PrepFlow optimizes it automatically."],
          ["Active / inactive", "Whether the meal shows on your storefront. Turn a meal off to hide it without deleting it."],
          ["Recipe / ingredients", "The ingredients (and amounts) that make the meal. Optional to sell, but required for cost, margin, purchasing, and waste numbers to work."],
        ],
        tips: ["Prices can be changed any time — Menu → click the meal → edit → Save. The change is live immediately.", "No photo yet? The card falls back to a clean color tile, so your storefront still looks tidy — but a real photo converts far better."],
      },
      {
        id: "adding-a-meal",
        title: "Adding a meal (the recipe)",
        where: "Sales → Menu → New menu item",
        img: "26-menu-new.png",
        does: "The form where you build a meal. The important part for the money features is the recipe: each ingredient, how much of it, and a trim % for waste. Enter this once and PrepFlow calculates the plate cost, margin, shopping list, and waste automatically forever.",
        numbers: [
          ["Name / Price", "Shown to customers. Price is what they pay."],
          ["Diet / Allergens / Macros", "Filters and labels shown on the storefront and on packing labels."],
          ["Photo", "The meal's picture, shown big on the storefront. Optional but strongly recommended — it's what sells the meal. Upload a landscape or square image (1000px+); it's optimized automatically."],
          ["Ingredient", "Pick an existing ingredient (so it reuses the price you've set) or type a new one."],
          ["Qty + Unit", "How much of that ingredient the recipe uses (e.g. 8 oz chicken). Units can be imperial or metric (oz, lb, g, kg, cup, ml, l…) — PrepFlow converts automatically (buy in lb, cook in g)."],
          ["Trim %", "The share of that ingredient lost in prep — peels, fat, stalks, ends. This is what powers the 'over-bought' waste number in Purchasing. Not sure of the number? Tap the calculator icon on the row, enter the raw and trimmed weight, and it works out the % for you."],
        ],
        tips: ["Always pick an ingredient from the dropdown when it already exists, so it uses the cost you set instead of creating a new $0 copy."],
      },
      {
        id: "meal-plans",
        title: "Meal Plans",
        where: "Sales → Meal Plans",
        img: "06-plans.png",
        does: "The subscription plans customers can sign up for (e.g. '5 meals a week', '10 meals a week'), with a per-meal price for subscribers. Plans create predictable, recurring revenue.",
        use: [
          "Meal Plans → create a plan.",
          "Set the number of meals per week and the per-meal price for subscribers.",
          "It appears as a subscription option on your storefront.",
        ],
        numbers: [
          ["Meals per week", "How many meals the plan includes each delivery."],
          ["Per-meal price", "What a subscriber pays per meal (usually a bit less than one-time, to reward committing)."],
        ],
        tips: ["Subscribers are your most valuable customers — they pay every week without you chasing them. Price plans a little below one-time to encourage signups."],
      },
      {
        id: "subscriptions",
        title: "Subscriptions",
        where: "Sales → Subscriptions",
        img: "07-subscriptions.png",
        does: "The live list of everyone currently subscribed — their plan, how often they get meals, their next delivery date, and their status. Manage pauses, skips, and cancellations here.",
        numbers: [
          ["Plan", "Which meal plan the customer is on."],
          ["Frequency", "Weekly or bi-weekly."],
          ["Next delivery", "The date their next box goes out."],
          ["Status", "Active, paused, or canceled. Paused/canceled subscriptions don't generate orders."],
        ],
        tips: ["Subscribers (or you) can skip, pause, or swap meals before the weekly cut-off time you set in Settings. After cut-off, that week's order is locked for the kitchen."],
      },
      {
        id: "orders",
        title: "Orders",
        where: "Sales → Orders",
        img: "08-orders.png",
        does: "Every order in one place — from the storefront, the POS, and subscriptions. The total at the top is your revenue; the list lets you find any order, change its status, or open it for details.",
        numbers: [
          ["Total (top-right)", "Total revenue across all the orders shown, and the order count."],
          ["Customer + code", "Who placed it, plus a short order code (e.g. #hiao9u) and the date."],
          ["Type", "One-time (a single storefront/POS order) or Subscription (from a recurring plan)."],
          ["Meals", "How many meals are in the order."],
          ["Status", "Where the order is: Paid, and you can move it through your fulfillment stages using the dropdown."],
          ["Total ($)", "What the customer paid for that order (meals + tax + fees)."],
        ],
        tips: ["Use the search box to find an order by customer name or order code. Click the arrow on the right to open an order and see its items, or issue a refund."],
      },
      {
        id: "customers",
        title: "Customers",
        where: "Sales → Customers",
        img: "09-customers.png",
        does: "Your customer list (a simple CRM) — everyone who has ordered or subscribed, with how much they've spent, how many times they've ordered, and their loyalty points.",
        numbers: [
          ["Customers", "Total number of unique customers."],
          ["Active subscribers", "How many are on a recurring plan right now."],
          ["Lifetime revenue", "All the money your customers have spent, total."],
          ["Points (under a name)", "Loyalty points that customer has earned (1 point per $1 of meals, by default). Rewards repeat business."],
          ["Orders", "How many orders that customer has placed."],
          ["Spend", "How much that customer has spent in total."],
          ["Subscription", "'Active' if they're on a plan, '—' if they only order one-time."],
        ],
        tips: ["Search by name, email, or phone to find anyone fast. Your highest-spend customers and active subscribers are the ones to look after."],
      },
      {
        id: "pos",
        title: "POS Terminal",
        where: "Sales → POS Terminal",
        img: "10-pos.png",
        does: "A point-of-sale for taking orders yourself — walk-ins, phone orders, or markets. Add meals, apply a discount, and record the sale. These orders flow into everything else (revenue, production, customers) just like storefront orders.",
        use: [
          "Open POS Terminal.",
          "Tap meals to add them to the order.",
          "Apply a discount if needed.",
          "Choose the customer (or add a new one) and record the sale.",
        ],
        tips: ["Use the POS when a customer orders in person or by phone. It keeps ALL your sales in one place, so your numbers are complete."],
      },
    ],
  },
  {
    label: "Kitchen",
    blurb: "Running prep day.",
    sections: [
      {
        id: "kitchen-os",
        title: "Kitchen OS (Production)",
        where: "Kitchen → Kitchen OS",
        img: "11-kitchen.png",
        does: "Your prep-day command center. It turns the week's orders into a clear production list — exactly what to make and how much — grouped so the kitchen knows what to cook. No clipboards, no re-counting.",
        numbers: [
          ["Meal + quantity", "Each meal to produce and the total number needed, added up across every order for the delivery."],
          ["Station / grouping", "Meals grouped by kitchen station so the line knows what to cook where."],
          ["Delivery date", "Which delivery day this production run is for."],
        ],
        tips: ["This list is built automatically from real orders — if an order comes in before cut-off, it's included. Everything downstream (labels, packing, purchasing) uses these same numbers."],
      },
      {
        id: "kds",
        title: "Kitchen Display (KDS)",
        where: "Kitchen → Kitchen Display",
        img: "12-kds.png",
        does: "A big-screen 'tickets' view for the kitchen — each meal to make is a card the team taps to move through stages (to-do → cooking → done). Meant to be left open on a screen in the kitchen.",
        use: [
          "Open Kitchen Display on a tablet or screen in the kitchen.",
          "Tap a ticket to advance it: to-do → cooking → done.",
          "The team always sees what's left to make.",
        ],
        tips: ["The KDS and Kitchen OS show the same work — KDS is the hands-on, tap-as-you-go version for during the cook; Kitchen OS is the planning list."],
      },
      {
        id: "purchasing",
        title: "Purchasing & Waste",
        where: "Kitchen → Purchasing",
        img: "13-purchasing.png",
        does: "Your smart shopping list — built from the week's real orders and 'trim-aware', so it shows exactly how many dollars of ingredients you're buying just to throw away in prep. This is the money number most kitchens have never seen.",
        numbers: [
          ["To purchase", "The total dollar value of ingredients you need to buy for the upcoming production run."],
          ["Over-bought (trim waste)", "Of that total, how many dollars are pure waste — ingredient you buy only to trim off and bin (fat, peels, ends). Cutting this drops straight to profit."],
          ["Waste share", "The over-bought amount as a percentage of your total purchase."],
          ["Per-ingredient — Need", "How much of the ingredient the recipes actually use (the edible amount)."],
          ["Per-ingredient — Buy", "How much you must actually buy to end up with that amount after trimming."],
          ["Per-ingredient — Cost/unit", "What you pay per unit for that ingredient."],
          ["Per-ingredient — Over-bought", "The dollars wasted on that specific ingredient. Biggest offenders are listed at the top."],
        ],
        tips: ["The over-bought number comes from the trim % you set on each recipe ingredient. Tighten cuts, portioning, or supplier specs on the top offenders to claw real money back every single week."],
      },
      {
        id: "inventory",
        title: "Inventory",
        where: "Kitchen → Inventory",
        img: "14-inventory.png",
        does: "What you have on hand and what each ingredient costs — the backbone of every cost, margin, and purchasing number. Set opening stock, log deliveries, run a stock count, and (on Pro) scan supplier invoices with AI to update stock and costs automatically.",
        use: [
          "Enter your opening (starting) stock with each ingredient's cost per unit.",
          "When a delivery arrives, log it (or scan the invoice) to add stock and set the real cost.",
          "Run a stock count any time to correct on-hand amounts.",
        ],
        numbers: [
          ["Ingredient + on-hand", "What you have in stock right now, in the unit you buy it (lb, cup, ea, etc.)."],
          ["Cost / unit", "What you pay per unit. This is what your plate cost, margins, and P&L are calculated from — keep it current."],
          ["Trim %", "Default share lost to prep for this ingredient (feeds the over-bought number)."],
          ["Low-stock threshold", "When on-hand drops below this, the ingredient is flagged so you reorder in time."],
          ["Shelf life / expiry", "How long the ingredient keeps — helps flag what to use first."],
        ],
        tips: ["AI Invoice Scanner (Pro): snap a photo or upload a PDF of a supplier invoice and PrepFlow reads the line items, updates your stock, and sets the real costs — no manual typing. It needs an Anthropic API key set up by the platform to run."],
      },
      {
        id: "waste",
        title: "Waste & Loss",
        where: "Kitchen → Waste & Loss",
        img: "15-waste.png",
        does: "A log of food you paid for that never became revenue — spoilage, dropped orders, remakes. It books the COST of the wasted food (not the sale price) so your true profit (in the P&L) reflects reality.",
        use: [
          "Choose Raw ingredient (spoiled stock) or Finished meal (a made meal that was lost).",
          "Pick the item and quantity, choose a reason (spoilage, dropped in transit, remake, etc.), add a note.",
          "Log loss — the cost is booked to your P&L.",
        ],
        numbers: [
          ["Total loss (period)", "The total COST of food wasted in the window."],
          ["Loss events", "How many separate losses were logged."],
          ["Biggest cause", "The reason (e.g. 'Dropped in transit') responsible for the most loss."],
          ["Where it's going", "A breakdown of loss dollars by reason."],
          ["Recent losses", "Each logged loss with its cost, quantity, date, and note."],
        ],
        tips: [
          "This books the COST of the food (its plate cost), not the $ you'd have sold it for. Waste is a cost problem — 'money that went in the bin.'",
          "A meal with no recipe/ingredient costs entered books $0 — because PrepFlow doesn't know what it cost to make. Cost your recipes (in Menu) for real numbers.",
          "Raw-ingredient losses also reduce your on-hand stock. Finished-meal losses book the plate cost (the meal was already made).",
        ],
      },
      {
        id: "labels",
        title: "Labels & Packing",
        where: "Kitchen → Labels & packing",
        img: "16-labels.png",
        does: "Print meal labels (name, macros, allergens, expiry) and packing slips for each order — built from the same orders and recipes, so nothing is re-typed. Choose label sizes and print a sheet or single labels.",
        use: [
          "Open Labels & packing for the delivery.",
          "Pick your label size/template.",
          "Print — labels for every meal and packing slips for every order.",
        ],
        tips: ["Labels pull the macros, allergens, and expiry straight from the meal's recipe and shelf-life — accurate and consistent every time."],
      },
      {
        id: "routes",
        title: "Delivery Routes",
        where: "Kitchen → Delivery Routes",
        img: "17-routes.png",
        does: "Groups the day's deliveries by area/zone so you (or a driver) can run an efficient route. Uses each order's delivery address and zone.",
        numbers: [
          ["Zone / area", "Deliveries grouped by the area you assigned (North, East, West, etc.)."],
          ["Stops", "Each delivery address on the route, with the customer and order."],
        ],
        tips: ["Set delivery zones in Settings; assign customers to zones so routes group cleanly. This is basic routing — enough to plan a delivery day without a separate app."],
      },
    ],
  },
  {
    label: "Marketing",
    blurb: "Growing sales.",
    sections: [
      {
        id: "promotions",
        title: "Promotions (Marketing)",
        where: "Marketing → Marketing",
        img: "18-marketing.png",
        does: "Three tools to drive sales: coupons customers redeem at checkout, gift cards you issue, and one-off email campaigns to your customers.",
        numbers: [
          ["Coupons — Code / value", "The code customers type at checkout and the discount (% off or $ off). Toggle a coupon on/off or delete it."],
          ["Gift cards — outstanding", "Total unredeemed gift-card value your customers are holding (a liability you'll fulfill)."],
          ["Gift card — balance 'of' total", "Each card shows remaining balance out of its original amount (e.g. $40.00 of $75.00)."],
          ["Email campaign — Send to", "Choose the audience: All customers, Lapsed (haven't ordered in 45+ days), or Active subscribers."],
        ],
        tips: ["'Lapsed (45+ days)' is your win-back list — a discount email to people who've drifted is one of the cheapest ways to bring revenue back. Emails send from your verified domain."],
      },
      {
        id: "share",
        title: "Share Links",
        where: "Marketing → Share links",
        img: "19-share.png",
        does: "Ready-made links to your storefront (and specific meals/plans) that you can post on Instagram, text to customers, or put in your bio — so people can order in one tap.",
        tips: ["Grab a link here instead of typing your storefront URL by hand. Great for social posts and DMs."],
      },
      {
        id: "storefront",
        title: "Your Storefront (what customers see)",
        where: "Public — prepflow.ca/store/your-kitchen",
        img: "25-storefront.png",
        does: "Your own branded ordering page. Customers browse meals, filter by diet, see macros and reviews, subscribe to a plan or order one-time, and pay — all themselves. A live countdown banner at the top ticks down to your weekly order cut-off, so customers feel the urgency to order before the deadline. This is what replaces taking orders by text and DM.",
        numbers: [
          ["Order cut-off countdown", "A banner across the top counts down — days, hours, minutes, seconds — to your next order cut-off, and shows the delivery date it unlocks (e.g. \"Order by Sat 8:00 PM — arrives Mon\"). When the deadline passes it flips to an \"ordering has closed\" message until the next window opens. It runs in your kitchen's own timezone."],
          ["Subscription plans", "Your Meal Plans shown as weekly/bi-weekly options with the per-week price."],
          ["Meal cards", "Each meal with its price, diet tag, calories, protein, and star rating."],
          ["Your order", "The customer's running cart before checkout."],
        ],
        tips: [
          "Everything a customer does here flows straight into your dashboard — orders, customers, production, and revenue. Share the link (see Share Links) on social and in your bio.",
          "The countdown timer is driven by the Order cut-off and timezone you set in Settings → Fulfillment. Change the cut-off there and the banner updates automatically — a real deadline is one of the simplest ways to get orders in before you shop and prep.",
        ],
      },
    ],
  },
  {
    label: "Admin",
    blurb: "Settings and money.",
    sections: [
      {
        id: "billing",
        title: "Billing & Plan",
        where: "Admin → Billing & plan",
        img: "20-billing.png",
        does: "Your PrepFlow subscription — which plan you're on (Starter / Growth / Pro), what it includes, and your trial status. This is what YOU pay PrepFlow, separate from the money your customers pay you.",
        numbers: [
          ["Current plan", "Starter, Growth, or Pro — sets your monthly fee, order limit, and platform fee %."],
          ["Trial", "During your 30-day free trial you get full Pro-level access to everything, on any plan."],
          ["Order limit", "How many orders your plan includes per month (Growth and Pro are unlimited)."],
        ],
        tips: ["Two different money flows: (1) your customers pay YOU for food (via Payouts/Stripe), and (2) you pay PREPFLOW a monthly software fee (here). They're separate."],
      },
      {
        id: "payouts",
        title: "Payouts",
        where: "Admin → Payouts",
        img: "21-payouts.png",
        does: "Connect your bank (through Stripe) so your customers' payments land in YOUR account. Until this is connected, your storefront can't take real card payments.",
        use: [
          "Payouts → Connect your bank.",
          "Complete Stripe's secure onboarding (business + bank details).",
          "Once it says 'You're connected', your storefront can take real payments.",
        ],
        numbers: [
          ["Platform fee", "The small % PrepFlow takes per charge (shown on the page). It's deducted automatically; the rest goes to your bank."],
          ["Connected status", "'Connect your bank' (not set up), 'Stripe is reviewing' (pending), or 'You're connected' (ready)."],
        ],
        tips: ["You never handle card or bank details yourself — Stripe does, securely. Customers pay you directly; PrepFlow just takes its small platform fee automatically."],
      },
      {
        id: "staff",
        title: "Staff",
        where: "Admin → Staff",
        img: "22-staff.png",
        does: "Invite your team and control what they can see. Staff members get a kitchen/operations view — they can run production and fulfillment but never see money, customers, or settings.",
        use: [
          "Staff → invite a team member by email.",
          "They get a login with staff-only access (kitchen + fulfillment).",
        ],
        numbers: [["Owner vs Staff", "Owners see everything (money, customers, settings). Staff see only the kitchen/operations screens."]],
        tips: ["Give kitchen team members Staff access — they get what they need for prep day without seeing revenue, margins, or customer data."],
      },
      {
        id: "import",
        title: "Import Data",
        where: "Admin → Import data",
        img: "23-import.png",
        does: "Bring your existing menu, customers, subscriptions, and inventory into PrepFlow from a spreadsheet (CSV) — so switching from another system takes an afternoon, not weeks.",
        use: [
          "Pick a tab: Menu, Customers, Subscriptions, or Inventory.",
          "Download the Template to see the exact columns.",
          "Paste your CSV or upload the file, then Import.",
        ],
        numbers: [
          ["Columns line", "Each tab lists the columns it expects (required and optional). Match your spreadsheet to these."],
          ["Template button", "Downloads a sample CSV with the right headers and example rows — the easiest way to get the format right."],
        ],
        tips: ["This is for spreadsheets (CSV). To read a paper/PDF supplier invoice into inventory, use the AI Invoice Scanner on the Inventory page instead."],
      },
      {
        id: "settings",
        title: "Settings",
        where: "Admin → Settings",
        img: "24-settings.png",
        does: "Your kitchen's rules and branding — fees, tax, delivery days, order cut-off, minimum order, subscription discount, and brand color. These apply across the storefront and checkout.",
        numbers: [
          ["Delivery fee", "What customers pay for delivery, added at checkout."],
          ["Processing fee", "An optional fee added per order."],
          ["Tax rate", "The sales tax applied at checkout (as a %)."],
          ["Order cut-off", "The day/time each week after which orders lock for the kitchen (e.g. 'Sat 8:00 PM'). Customers can edit/skip before this; after it, the kitchen's list is fixed."],
          ["Minimum order", "The smallest order value a customer can check out with."],
          ["Subscription discount", "An automatic discount for subscribers vs one-time buyers."],
          ["Points per $1", "How many loyalty points customers earn per dollar spent."],
          ["Brand color", "Your storefront's accent color."],
        ],
        tips: ["The order cut-off is important: it's the deadline that turns 'customers can still change their order' into 'the kitchen's production list is locked.' Set it to give yourself enough prep lead time."],
      },
    ],
  },
  {
    label: "Help",
    blurb: "Guides, and how to reach us.",
    sections: [
      {
        id: "support",
        title: "Contact support",
        where: "Help → Contact support",
        does: "Send the PrepFlow team a message straight from your dashboard when you're stuck or spot a bug. Your message is emailed to us with your kitchen's name attached, and we reply to the email you enter.",
        use: [
          "Open Help → Contact support.",
          "Check the reply-to email (it's pre-filled with your account email — change it if you want the reply elsewhere).",
          "Pick a topic, add a short subject, and describe what you need — include order or customer names if it helps.",
          "Send. You'll see a confirmation, and we reply by email.",
        ],
        tips: [
          "For anything urgent that's blocking orders going out, put 'URGENT' in the subject.",
          "Looking for how a screen works before you write in? This Guide covers every page — try the search box at the top.",
        ],
      },
    ],
  },
];
