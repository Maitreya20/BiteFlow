/**
 * Prototype seed dataset — prd.md §31 requires three tenants with different brand,
 * menu, tables and demo data:
 *   • Urban Bean Cafe        (Growth)  — the golden-path demo tenant
 *   • Spice Route Restaurant (Pro)
 *   • The Green Bowl         (Starter)
 *
 * When Supabase is configured this mirrors `supabase/seed.sql`; otherwise it is the
 * source of truth for demo mode so the whole product runs with zero setup.
 */
import type {
  AppNotification,
  AuditLog,
  Branding,
  BusinessType,
  Customer,
  DemoDatabase,
  InventoryItem,
  Invoice,
  MenuCategory,
  MenuItem,
  MenuOptionGroup,
  Membership,
  Order,
  OrderChannel,
  OrderItem,
  OrderStatus,
  Organization,
  PaymentMethod,
  PlanId,
  Profile,
  Reservation,
  RestaurantTable,
  ServiceRequest,
  TableStatus,
} from '@/lib/types'
import { ago, fromNow, uid } from '@/lib/format'

/* ------------------------------------------------------------------ helpers */

const optionGroups: Record<string, MenuOptionGroup> = {
  size: {
    id: 'og_size',
    name: 'Size',
    type: 'single',
    required: true,
    options: [
      { id: 'o_size_reg', name: 'Regular', priceDelta: 0, isDefault: true },
      { id: 'o_size_lg', name: 'Large', priceDelta: 60 },
      { id: 'o_size_share', name: 'Sharing', priceDelta: 140 },
    ],
  },
  milk: {
    id: 'og_milk',
    name: 'Milk',
    type: 'single',
    required: false,
    options: [
      { id: 'o_milk_whole', name: 'Whole milk', priceDelta: 0, isDefault: true },
      { id: 'o_milk_oat', name: 'Oat milk', priceDelta: 40 },
      { id: 'o_milk_almond', name: 'Almond milk', priceDelta: 40 },
      { id: 'o_milk_skim', name: 'Skimmed', priceDelta: 0 },
    ],
  },
  addons: {
    id: 'og_addons',
    name: 'Add-ons',
    type: 'multi',
    required: false,
    options: [
      { id: 'o_add_cheese', name: 'Extra cheese', priceDelta: 50 },
      { id: 'o_add_bacon', name: 'Smoked bacon', priceDelta: 90 },
      { id: 'o_add_fries', name: 'Side of fries', priceDelta: 110 },
      { id: 'o_add_egg', name: 'Fried egg', priceDelta: 45 },
    ],
  },
  spice: {
    id: 'og_spice',
    name: 'Spice level',
    type: 'single',
    required: true,
    options: [
      { id: 'o_spice_mild', name: 'Mild', priceDelta: 0, isDefault: true },
      { id: 'o_spice_med', name: 'Medium', priceDelta: 0 },
      { id: 'o_spice_hot', name: 'Hot', priceDelta: 0 },
      { id: 'o_spice_extra', name: 'Extra hot 🔥', priceDelta: 20 },
    ],
  },
  portion: {
    id: 'og_portion',
    name: 'Portion',
    type: 'single',
    required: true,
    options: [
      { id: 'o_portion_half', name: 'Half', priceDelta: -60 },
      { id: 'o_portion_full', name: 'Full', priceDelta: 0, isDefault: true },
      { id: 'o_portion_family', name: 'Family (serves 4)', priceDelta: 320 },
    ],
  },
  protein: {
    id: 'og_protein',
    name: 'Choose protein',
    type: 'single',
    required: true,
    options: [
      { id: 'o_pro_paneer', name: 'Paneer', priceDelta: 0, isDefault: true },
      { id: 'o_pro_chicken', name: 'Chicken', priceDelta: 80 },
      { id: 'o_pro_tofu', name: 'Tofu', priceDelta: 20 },
      { id: 'o_pro_prawn', name: 'Prawn', priceDelta: 140 },
    ],
  },
  noodles: {
    id: 'og_noodles',
    name: 'Base',
    type: 'single',
    required: true,
    options: [
      { id: 'o_nood_rice', name: 'Rice bowl', priceDelta: 0, isDefault: true },
      { id: 'o_nood_greens', name: 'Extra greens', priceDelta: 40 },
      { id: 'o_nood_quinoa', name: 'Quinoa base', priceDelta: 70 },
      { id: 'o_nood_sourdough', name: 'Sourdough side', priceDelta: 55 },
    ],
  },
  sweet: {
    id: 'og_sweet',
    name: 'Sweetness',
    type: 'single',
    required: false,
    options: [
      { id: 'o_sw_none', name: 'No sugar', priceDelta: 0 },
      { id: 'o_sw_low', name: 'Less sweet', priceDelta: 0, isDefault: true },
      { id: 'o_sw_reg', name: 'Regular', priceDelta: 0 },
      { id: 'o_sw_double', name: 'Extra sweet', priceDelta: 0 },
    ],
  },
}

type MenuSeed = [name: string, description: string, price: number, extra?: Partial<MenuItem>]

interface MenuBlueprint {
  category: Omit<MenuCategory, 'organizationId' | 'id'>
  items: MenuSeed[]
}

/* --------------------------------------------------------------- Urban Bean */

const URBAN_BEAN_BRANDING: Branding = {
  logoUrl: null,
  logoEmoji: '☕',
  primaryColor: '#EA580C',
  secondaryColor: '#0F172A',
  accentColor: '#F97316',
  fontFamily: 'Manrope',
  radiusScale: 'soft',
  buttonStyle: 'solid',
  cardStyle: 'elevated',
  menuLayout: 'grid',
  heroHeadline: 'Slow-roasted mornings, all day',
  heroSubcopy:
    'Single-origin espresso, woodfired sourdough and all-day brunch in the heart of downtown.',
  heroImageUrl: null,
  tagline: 'Specialty coffee & all-day brunch',
  address: '18 Maple Lane, Downtown',
  phone: '+91 98200 41120',
  rating: 4.8,
  isOpen: true,
  currency: 'INR',
  taxPercent: 5,
  serviceChargePercent: 0,
}

const URBAN_BEAN_MENU: MenuBlueprint[] = [
  {
    category: { name: 'Signature Coffee', description: 'House-roasted single origin', icon: 'local_cafe', sortOrder: 1, isActive: true },
    items: [
      ['Cold Brew Hazelnut', '18-hour steeped cold brew, toasted hazelnut, oat milk over clear ice.', 220, { isTrending: true, prepTimeMinutes: 4, calories: 140, tags: ['Bestseller', 'Iced'], optionGroups: [optionGroups.size, optionGroups.milk, optionGroups.sweet] }],
      ['Ember Flat White', 'Double ristretto, velvety micro-foam, a whisper of burnt caramel.', 210, { isChefPick: true, prepTimeMinutes: 3, calories: 120, tags: ['Hot'], optionGroups: [optionGroups.size, optionGroups.milk] }],
      ['Truffle Mushroom Latte', 'Savoury latte with porcini dust and truffle oil — a cult favourite.', 280, { prepTimeMinutes: 6, calories: 190, optionGroups: [optionGroups.size, optionGroups.milk] }],
      ['Classic Cappuccino', 'Equal thirds espresso, steamed milk and airy foam.', 190, { prepTimeMinutes: 3, calories: 110, optionGroups: [optionGroups.size, optionGroups.milk, optionGroups.sweet] }],
      ['Maple Cortado', 'Two shots cut with maple-steamed milk.', 200, { prepTimeMinutes: 3, calories: 130, optionGroups: [optionGroups.milk] }],
    ],
  },
  {
    category: { name: 'All-Day Brunch', description: 'Served until close', icon: 'egg_alt', sortOrder: 2, isActive: true },
    items: [
      ['Truffle Mushroom Risotto', 'Carnaroli rice, wild mushrooms, aged parmesan, shaved fresh truffle.', 580, { isChefPick: true, isTrending: true, isVegetarian: true, prepTimeMinutes: 18, calories: 640, tags: ['Top Seller'], optionGroups: [optionGroups.addons] }],
      ['Woodfired Margherita', 'Blistered leopard crust, San Marzano, buffalo mozzarella, basil.', 490, { isVegetarian: true, prepTimeMinutes: 14, calories: 780, tags: ['Vegetarian'], optionGroups: [optionGroups.size, optionGroups.addons] }],
      ['Truffle Brioche Burger', 'Wagyu patty, truffle aioli, aged cheddar, brioche bun, hand-cut fries.', 680, { isTrending: true, prepTimeMinutes: 16, calories: 920, allergens: ['Gluten', 'Dairy', 'Egg'], optionGroups: [optionGroups.addons] }],
      ['Smoked Salmon Sourdough', 'House-cured salmon, dill crème fraîche, capers, rye sourdough.', 620, { prepTimeMinutes: 10, calories: 520, allergens: ['Gluten', 'Fish', 'Dairy'], optionGroups: [optionGroups.addons] }],
      ['Shakshuka Skillet', 'Two eggs baked in spiced tomato, feta, za\'atar, warm pita.', 460, { isVegetarian: true, isSpicy: true, prepTimeMinutes: 15, calories: 560, optionGroups: [optionGroups.addons] }],
      ['Buttermilk Pancake Stack', 'Three pancakes, whipped maple butter, berry compote.', 420, { isVegetarian: true, prepTimeMinutes: 12, calories: 690 }],
    ],
  },
  {
    category: { name: 'Bowls & Greens', description: 'Light and seasonal', icon: 'eco', sortOrder: 3, isActive: true },
    items: [
      ['Harvest Grain Bowl', 'Farro, roasted squash, kale, pomegranate, tahini drizzle.', 480, { isVegetarian: true, prepTimeMinutes: 9, calories: 430, optionGroups: [optionGroups.protein] }],
      ['Charred Chicken Caesar', 'Grilled chicken, romaine, sourdough croutons, anchovy dressing.', 520, { prepTimeMinutes: 11, calories: 610, allergens: ['Gluten', 'Fish', 'Egg'] }],
      ['Beetroot & Goat Cheese', 'Candied beets, whipped goat cheese, candied walnuts, rocket.', 460, { isVegetarian: true, prepTimeMinutes: 8, calories: 380 }],
    ],
  },
  {
    category: { name: 'Sweet Finish', description: 'Pastry counter', icon: 'cake', sortOrder: 4, isActive: true },
    items: [
      ['Tahini Tiramisu', 'Espresso-soaked savoiardi, tahini mascarpone, cocoa nib.', 340, { isChefPick: true, isVegetarian: true, prepTimeMinutes: 4, calories: 460 }],
      ['Dark Chocolate Brownie', '70% single-origin chocolate, fudge centre, sea salt.', 260, { isVegetarian: true, prepTimeMinutes: 3, calories: 510 }],
      ['Almond Croissant', 'Twice-baked, frangipane filled, toasted flakes.', 240, { isVegetarian: true, prepTimeMinutes: 2, calories: 430, allergens: ['Gluten', 'Dairy', 'Nuts'] }],
    ],
  },
]

/* ------------------------------------------------------------ Spice Route */

const SPICE_ROUTE_BRANDING: Branding = {
  logoUrl: null,
  logoEmoji: '🍛',
  primaryColor: '#B91C1C',
  secondaryColor: '#1C1917',
  accentColor: '#F59E0B',
  fontFamily: 'Sora',
  radiusScale: 'sharp',
  buttonStyle: 'solid',
  cardStyle: 'elevated',
  menuLayout: 'list',
  heroHeadline: 'Kerala coast to Punjabi tandoor',
  heroSubcopy: 'Slow-cooked regional curries, coal-fired kebabs and clay-oven breads.',
  heroImageUrl: null,
  tagline: 'Regional Indian kitchen',
  address: '4 Marine Drive, Coastal Quarter',
  phone: '+91 98111 77240',
  rating: 4.6,
  isOpen: true,
  currency: 'INR',
  taxPercent: 5,
  serviceChargePercent: 8,
}

const SPICE_ROUTE_MENU: MenuBlueprint[] = [
  {
    category: { name: 'Tandoor Starters', description: 'Clay oven, coal fired', icon: 'local_fire_department', sortOrder: 1, isActive: true },
    items: [
      ['Chicken Malai Tikka', 'Cream-marinated chicken thigh, cardamom, charred in the tandoor.', 420, { isTrending: true, isSpicy: true, prepTimeMinutes: 16, calories: 480, optionGroups: [optionGroups.spice] }],
      ['Paneer Tikka Achari', 'Pickled-spice paneer, bell pepper, onion petals.', 380, { isVegetarian: true, isSpicy: true, prepTimeMinutes: 15, calories: 430, optionGroups: [optionGroups.spice] }],
      ['Tandoori Prawn Koliwada', 'Coastal masala prawns, curry leaf, lime.', 640, { isChefPick: true, prepTimeMinutes: 18, calories: 390, allergens: ['Shellfish'], optionGroups: [optionGroups.spice] }],
      ['Dahi Ke Kebab', 'Hung-curd dumplings, mint chutney, crisp exterior.', 340, { isVegetarian: true, prepTimeMinutes: 14, calories: 350 }],
    ],
  },
  {
    category: { name: 'Signature Curries', description: 'Slow simmered gravies', icon: 'soup_kitchen', sortOrder: 2, isActive: true },
    items: [
      ['Kerala Fish Moilee', 'Coconut milk, raw mango, turmeric, seer fish.', 680, { isChefPick: true, prepTimeMinutes: 22, calories: 520, allergens: ['Fish'], optionGroups: [optionGroups.spice, optionGroups.portion] }],
      ['Dal Bukhara', 'Black urad slow-cooked 14 hours over coal, butter finished.', 420, { isVegetarian: true, isTrending: true, prepTimeMinutes: 12, calories: 440, optionGroups: [optionGroups.portion] }],
      ['Butter Chicken', 'Tandoori chicken, tomato-fenugreek makhani gravy.', 620, { prepTimeMinutes: 20, calories: 690, allergens: ['Dairy'], optionGroups: [optionGroups.spice, optionGroups.portion] }],
      ['Laal Maas', 'Rajasthani mutton, Mathania chilli, smoked ghee.', 780, { isSpicy: true, prepTimeMinutes: 26, calories: 720, optionGroups: [optionGroups.spice, optionGroups.portion] }],
      ['Palak Paneer', 'Spinach purée, hand-pressed paneer, roasted garlic.', 460, { isVegetarian: true, prepTimeMinutes: 14, calories: 410, optionGroups: [optionGroups.portion] }],
    ],
  },
  {
    category: { name: 'Biryani & Rice', description: 'Sealed dum pots', icon: 'rice_bowl', sortOrder: 3, isActive: true },
    items: [
      ['Hyderabadi Dum Biryani', 'Sealed clay pot, saffron, fried onion, mirchi ka salan.', 560, { isTrending: true, isSpicy: true, prepTimeMinutes: 25, calories: 810, optionGroups: [optionGroups.protein, optionGroups.spice] }],
      ['Prawn Biryani', 'Coastal prawns, short-grain rice, curry leaf tempering.', 720, { prepTimeMinutes: 24, calories: 760, allergens: ['Shellfish'] }],
      ['Jeera Rice', 'Basmati, cumin tempering, ghee.', 240, { isVegetarian: true, prepTimeMinutes: 8, calories: 320 }],
    ],
  },
  {
    category: { name: 'Breads', description: 'From the clay oven', icon: 'bakery_dining', sortOrder: 4, isActive: true },
    items: [
      ['Garlic Naan', 'Leavened dough, roasted garlic, coriander butter.', 120, { isVegetarian: true, prepTimeMinutes: 6, calories: 260, allergens: ['Gluten', 'Dairy'] }],
      ['Laccha Paratha', 'Layered whole wheat, ghee brushed.', 110, { isVegetarian: true, prepTimeMinutes: 7, calories: 290 }],
      ['Tandoori Roti', 'Whole wheat, direct on clay wall.', 80, { isVegetarian: true, prepTimeMinutes: 5, calories: 180 }],
    ],
  },
  {
    category: { name: 'Desserts', description: '', icon: 'icecream', sortOrder: 5, isActive: true },
    items: [
      ['Shahi Tukda', 'Saffron rabri, crisp bread, pistachio.', 320, { isVegetarian: true, prepTimeMinutes: 6, calories: 470 }],
      ['Gulab Jamun (2 pc)', 'Warm milk dumplings in rose syrup.', 220, { isVegetarian: true, prepTimeMinutes: 5, calories: 400 }],
    ],
  },
]

/* ------------------------------------------------------------ Green Bowl */

const GREEN_BOWL_BRANDING: Branding = {
  logoUrl: null,
  logoEmoji: '🥗',
  primaryColor: '#15803D',
  secondaryColor: '#14532D',
  accentColor: '#84CC16',
  fontFamily: 'DM Sans',
  radiusScale: 'round',
  buttonStyle: 'pill',
  cardStyle: 'flat',
  menuLayout: 'magazine',
  heroHeadline: 'Plant-forward bowls, built in seconds',
  heroSubcopy: 'Cold-pressed, locally sourced, zero-waste kitchen. Build your own bowl.',
  heroImageUrl: null,
  tagline: 'Plant-forward build-your-own bowls',
  address: '62 Orchard Street, Food Hall B',
  phone: '+91 97400 22981',
  rating: 4.7,
  isOpen: false,
  currency: 'INR',
  taxPercent: 5,
  serviceChargePercent: 0,
}

const GREEN_BOWL_MENU: MenuBlueprint[] = [
  {
    category: { name: 'Build Your Bowl', description: 'Pick a base, add a protein', icon: 'rice_bowl', sortOrder: 1, isActive: true },
    items: [
      ['Superfood Sunrise Bowl', 'Quinoa, roasted sweet potato, avocado, edamame, miso ginger dressing.', 420, { isTrending: true, isVegetarian: true, prepTimeMinutes: 7, calories: 480, tags: ['Vegan'], optionGroups: [optionGroups.noodles, optionGroups.protein] }],
      ['Smoky Chipotle Bowl', 'Brown rice, black beans, charred corn, chipotle crema.', 440, { isSpicy: true, isVegetarian: true, prepTimeMinutes: 8, calories: 540, optionGroups: [optionGroups.noodles, optionGroups.protein] }],
      ['Green Goddess Bowl', 'Kale, broccoli, zucchini ribbons, hemp seeds, herb tahini.', 460, { isChefPick: true, isVegetarian: true, prepTimeMinutes: 6, calories: 390, tags: ['Vegan'], optionGroups: [optionGroups.noodles, optionGroups.protein] }],
      ['Teriyaki Tofu Bowl', 'Jasmine rice, glazed tofu, pickled slaw, sesame.', 440, { isVegetarian: true, prepTimeMinutes: 9, calories: 520, optionGroups: [optionGroups.noodles, optionGroups.protein] }],
    ],
  },
  {
    category: { name: 'Cold Press Juice', description: 'Pressed to order', icon: 'local_drink', sortOrder: 2, isActive: true },
    items: [
      ['Emerald Reset', 'Cucumber, celery, green apple, lime, mint.', 260, { isVegetarian: true, prepTimeMinutes: 4, calories: 110, optionGroups: [optionGroups.sweet] }],
      ['Sunrise Citrus', 'Orange, carrot, turmeric, ginger.', 240, { isVegetarian: true, prepTimeMinutes: 4, calories: 130 }],
      ['Beet Recovery', 'Beetroot, apple, lemon, black pepper.', 280, { isVegetarian: true, prepTimeMinutes: 5, calories: 140 }],
    ],
  },
  {
    category: { name: 'Snacks & Sides', description: '', icon: 'bakery_dining', sortOrder: 3, isActive: true },
    items: [
      ['Sweet Potato Fries', 'Air-fried, smoked paprika salt, garlic aioli.', 220, { isVegetarian: true, prepTimeMinutes: 8, calories: 310, optionGroups: [optionGroups.addons] }],
      ['Miso Roasted Broccoli', 'Charred broccoli, miso glaze, toasted almond.', 240, { isVegetarian: true, prepTimeMinutes: 7, calories: 220, allergens: ['Nuts', 'Soy'] }],
    ],
  },
]

/* ------------------------------------------------------------------ factories */

function makeBranding(overrides: Partial<Branding>): Branding {
  return {
    logoUrl: null,
    logoEmoji: '🍽️',
    primaryColor: '#EA580C',
    secondaryColor: '#0F172A',
    accentColor: '#F97316',
    fontFamily: 'Manrope',
    radiusScale: 'soft',
    buttonStyle: 'solid',
    cardStyle: 'elevated',
    menuLayout: 'grid',
    heroHeadline: 'Welcome',
    heroSubcopy: '',
    heroImageUrl: null,
    tagline: '',
    address: '',
    phone: '',
    rating: 4.5,
    isOpen: true,
    currency: 'INR',
    taxPercent: 5,
    serviceChargePercent: 0,
    ...overrides,
  }
}

interface TenantBlueprint {
  id: string
  name: string
  slug: string
  businessType: BusinessType
  gstNumber: string
  planId: PlanId
  createdAt: string
  branding: Branding
  menu: MenuBlueprint[]
  tableCount: number
  zonePlan: { zone: RestaurantTable['zone']; count: number; capacity: number }[]
}

const TENANT_BLUEPRINTS: TenantBlueprint[] = [
  {
    id: 'org_urbanbean',
    name: 'Urban Bean Cafe',
    slug: 'urban-bean-cafe',
    businessType: 'cafe',
    gstNumber: '29AABCT1332L1Z5',
    planId: 'growth',
    createdAt: ago(60 * 24 * 210),
    branding: URBAN_BEAN_BRANDING,
    menu: URBAN_BEAN_MENU,
    tableCount: 24,
    zonePlan: [
      { zone: 'Indoor', count: 12, capacity: 4 },
      { zone: 'Terrace', count: 8, capacity: 2 },
      { zone: 'Bar', count: 4, capacity: 6 },
    ],
  },
  {
    id: 'org_spiceroute',
    name: 'Spice Route Restaurant',
    slug: 'spice-route',
    businessType: 'restaurant',
    gstNumber: '27AACCS4821P1ZK',
    planId: 'pro',
    createdAt: ago(60 * 24 * 420),
    branding: SPICE_ROUTE_BRANDING,
    menu: SPICE_ROUTE_MENU,
    tableCount: 32,
    zonePlan: [
      { zone: 'Indoor', count: 18, capacity: 4 },
      { zone: 'Private', count: 6, capacity: 8 },
      { zone: 'Terrace', count: 8, capacity: 4 },
    ],
  },
  {
    id: 'org_greenbowl',
    name: 'The Green Bowl',
    slug: 'the-green-bowl',
    businessType: 'food_court',
    gstNumber: '07AAGCG7788N1Z2',
    planId: 'starter',
    createdAt: ago(60 * 24 * 75),
    branding: GREEN_BOWL_BRANDING,
    menu: GREEN_BOWL_MENU,
    tableCount: 14,
    zonePlan: [
      { zone: 'Indoor', count: 10, capacity: 2 },
      { zone: 'Terrace', count: 4, capacity: 4 },
    ],
  },
]

const WAITER_POOL = ['Rahul Mehta', 'Priya Nair', 'Ishaan Verma', 'Fatima Sheikh']

const CUSTOMER_POOL: [name: string, phone: string, tier: Customer['tier']][] = [
  ['Ananya Sharma', '+91 98450 11223', 'gold'],
  ['Rohit Kapoor', '+91 98110 44556', 'silver'],
  ['Meera Iyer', '+91 99001 77889', 'platinum'],
  ['Devansh Gupta', '+91 90070 33445', 'bronze'],
  ['Sneha Reddy', '+91 97400 99112', 'gold'],
  ['Karan Malhotra', '+91 98220 66778', 'silver'],
  ['Aisha Khan', '+91 99860 22134', 'bronze'],
  ['Vikram Rao', '+91 97110 55443', 'gold'],
  ['Tanvi Joshi', '+91 98456 78890', 'silver'],
  ['Arjun Pillai', '+91 96770 12345', 'bronze'],
  ['Nisha Bhatt', '+91 90334 98877', 'platinum'],
  ['Sameer Sheikh', '+91 98250 30011', 'silver'],
]

/* ------------------------------------------------------------------ builders */

function buildTenant(bp: TenantBlueprint) {
  const categories: MenuCategory[] = []
  const items: MenuItem[] = []

  bp.menu.forEach((group, ci) => {
    const categoryId = `cat_${bp.slug}_${ci}`
    categories.push({
      id: categoryId,
      organizationId: bp.id,
      name: group.category.name,
      description: group.category.description,
      icon: group.category.icon,
      sortOrder: group.category.sortOrder,
      isActive: group.category.isActive,
    })
    group.items.forEach((seed, ii) => {
      const [name, description, price, extra] = seed
      items.push({
        id: `item_${bp.slug}_${ci}_${ii}`,
        organizationId: bp.id,
        categoryId,
        name,
        description,
        price,
        imageUrl: null,
        prepTimeMinutes: 10,
        calories: 350,
        available: true,
        isChefPick: false,
        isTrending: false,
        isVegetarian: false,
        isSpicy: false,
        allergens: [],
        tags: [],
        optionGroups: [],
        sortOrder: ii,
        ...extra,
      })
    })
  })

  const tables: RestaurantTable[] = []
  let n = 1
  for (const plan of bp.zonePlan) {
    for (let i = 0; i < plan.count; i++) {
      const tableNumber = `T-${String(n).padStart(2, '0')}`
      const col = (n - 1) % 6
      const row = Math.floor((n - 1) / 6)
      tables.push({
        id: `tbl_${bp.slug}_${n}`,
        organizationId: bp.id,
        branchId: `br_${bp.slug}_main`,
        tableNumber,
        capacity: plan.capacity,
        status: 'available',
        assignedWaiterId: null,
        assignedWaiterName: null,
        currentBill: 0,
        occupiedSince: null,
        qrToken: `${bp.slug}-${tableNumber.toLowerCase()}-${(n * 7919) % 9973}`,
        zone: plan.zone,
        posX: col,
        posY: row,
      })
      n++
    }
  }

  return { categories, items, tables }
}

/* ---------------------------------------------------------------- order gen */

function buildOrder(opts: {
  orgId: string
  tableNumber: string | null
  tableId: string | null
  index: number
  status: OrderStatus
  placedMinutesAgo: number
  menuItems: MenuItem[]
  customerName: string | null
  customerId: string | null
  channel?: OrderChannel
  taxPercent: number
  serviceChargePercent: number
}): Order {
  const {
    orgId, tableNumber, tableId, index, status, placedMinutesAgo,
    menuItems, customerName, customerId, channel = 'dine_in', taxPercent, serviceChargePercent,
  } = opts

  const itemCount = 2 + (index % 3)
  const items: OrderItem[] = []
  for (let i = 0; i < itemCount; i++) {
    const menuItem = menuItems[(index * 3 + i * 7) % menuItems.length]
    const quantity = 1 + ((index + i) % 2)
    const chosen = menuItem.optionGroups.length
      ? [menuItem.optionGroups[0].options[0]]
      : []
    const optionsTotal = chosen.reduce((sum, o) => sum + o.priceDelta, 0)
    const unitPrice = menuItem.price
    items.push({
      id: `oi_${orgId}_${index}_${i}`,
      orderId: `ord_${orgId}_${index}`,
      menuItemId: menuItem.id,
      name: menuItem.name,
      unitPrice,
      quantity,
      options: chosen.map((o) => o.name),
      optionsTotal,
      notes: i === 0 && index % 4 === 0 ? 'Extra crispy, no pickles' : '',
      lineTotal: (unitPrice + optionsTotal) * quantity,
    })
  }

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0)
  const taxAmount = Math.round((subtotal * taxPercent) / 100)
  const serviceCharge = Math.round((subtotal * serviceChargePercent) / 100)
  const discount = index % 7 === 0 ? 50 : 0
  const total = subtotal + taxAmount + serviceCharge - discount

  const placedAt = ago(placedMinutesAgo)
  const step = (mins: number) => ago(Math.max(1, placedMinutesAgo - mins))

  const reached = (stage: OrderStatus): boolean => {
    const order: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'served', 'completed']
    return order.indexOf(status) >= order.indexOf(stage) && status !== 'cancelled'
  }

  const isPaid = status === 'completed'

  return {
    id: `ord_${orgId}_${index}`,
    organizationId: orgId,
    orderNumber: `BF-${1000 + index}`,
    channel,
    tableId,
    tableNumber,
    customerId,
    customerName,
    status,
    items,
    subtotal,
    taxAmount,
    serviceCharge,
    discount,
    total,
    notes: index % 5 === 0 ? 'Birthday celebration — please bring dessert with a candle.' : '',
    allergyNote: index % 6 === 0 ? 'Severe peanut allergy at the table.' : '',
    kitchenNote: index % 4 === 1 ? 'Fire together with the mains.' : '',
    paymentStatus: isPaid ? 'paid' : 'unpaid',
    paymentMethod: isPaid ? (index % 3 === 0 ? 'upi' : 'card') : null,
    placedAt,
    acceptedAt: reached('accepted') ? step(2) : null,
    preparingAt: reached('preparing') ? step(5) : null,
    readyAt: reached('ready') ? step(14) : null,
    servedAt: reached('served') ? step(18) : null,
    completedAt: reached('completed') ? step(30) : null,
    cancelledAt: status === 'cancelled' ? step(3) : null,
    cancelledReason: status === 'cancelled' ? 'Guest left before service' : null,
  }
}

/* ------------------------------------------------------------------- build */

export function buildSeedDatabase(): DemoDatabase {
  const profiles: Profile[] = [
    {
      id: 'user_owner',
      email: 'owner@urbanbean.test',
      fullName: 'Aarav Mehta',
      avatarUrl: null,
      phone: '+91 98200 41120',
      createdAt: ago(60 * 24 * 240),
    },
    {
      id: 'user_super',
      email: 'admin@biteflow.com',
      fullName: 'Nadia Rahman',
      avatarUrl: null,
      phone: '+91 90000 00001',
      createdAt: ago(60 * 24 * 400),
    },
    {
      id: 'user_manager',
      email: 'manager@urbanbean.test',
      fullName: 'Rahul Mehta',
      avatarUrl: null,
      phone: '+91 98200 99887',
      createdAt: ago(60 * 24 * 120),
    },
    {
      id: 'user_chef',
      email: 'chef@urbanbean.test',
      fullName: 'Chef Imran Qureshi',
      avatarUrl: null,
      phone: '+91 98200 55443',
      createdAt: ago(60 * 24 * 190),
    },
  ]

  const organizations: Organization[] = []
  const memberships: Membership[] = []
  const categories: MenuCategory[] = []
  const menuItems: MenuItem[] = []
  const tables: RestaurantTable[] = []
  const orders: Order[] = []
  const serviceRequests: ServiceRequest[] = []
  const reservations: Reservation[] = []
  const inventory: InventoryItem[] = []
  const customers: Customer[] = []
  const invoices: Invoice[] = []
  const paymentMethods: PaymentMethod[] = []
  const auditLogs: AuditLog[] = []
  const notifications: AppNotification[] = []

  TENANT_BLUEPRINTS.forEach((bp, tenantIndex) => {
    organizations.push({
      id: bp.id,
      name: bp.name,
      slug: bp.slug,
      businessType: bp.businessType,
      gstNumber: bp.gstNumber,
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      language: 'en-IN',
      planId: bp.planId,
      subscriptionStatus: 'active',
      trialEndsAt: null,
      renewsAt: fromNow(60 * 24 * (12 + tenantIndex * 9)),
      createdAt: bp.createdAt,
      seededDemo: true,
      branding: makeBranding(bp.branding),
    })

    memberships.push({
      id: `mem_${bp.slug}_owner`,
      organizationId: bp.id,
      userId: 'user_owner',
      role: tenantIndex === 1 ? 'manager' : 'owner',
      status: 'active',
      shift: 'Full day',
      invitedAt: bp.createdAt,
      lastActiveAt: ago(12),
    })
    memberships.push({
      id: `mem_${bp.slug}_manager`,
      organizationId: bp.id,
      userId: 'user_manager',
      role: 'manager',
      status: 'active',
      shift: 'Morning (08:00 – 16:00)',
      invitedAt: ago(60 * 24 * 100),
      lastActiveAt: ago(40),
    })
    memberships.push({
      id: `mem_${bp.slug}_chef`,
      organizationId: bp.id,
      userId: 'user_chef',
      role: 'chef',
      status: 'active',
      shift: 'Evening (16:00 – 00:00)',
      invitedAt: ago(60 * 24 * 150),
      lastActiveAt: ago(5),
    })
    memberships.push({
      id: `mem_${bp.slug}_super`,
      organizationId: bp.id,
      userId: 'user_super',
      role: 'super_admin',
      status: 'active',
      shift: 'Platform',
      invitedAt: bp.createdAt,
      lastActiveAt: ago(60 * 24),
    })

    const built = buildTenant(bp)
    categories.push(...built.categories)
    menuItems.push(...built.items)
    tables.push(...built.tables)

    /* ---- live + historical orders ------------------------------------- */
    const liveSpec: [OrderStatus, number, string | null][] = [
      ['pending', 2, 'T-02'],
      ['accepted', 4, 'T-07'],
      ['preparing', 9, 'T-04'],
      ['preparing', 13, 'T-11'],
      ['ready', 19, 'T-05'],
      ['served', 27, 'T-09'],
    ]
    liveSpec.forEach(([status, mins, tableNumber], i) => {
      const table = tableNumber ? built.tables.find((t) => t.tableNumber === tableNumber) : null
      orders.push(
        buildOrder({
          orgId: bp.id,
          tableNumber,
          tableId: table?.id ?? null,
          index: tenantIndex * 100 + i + 1,
          status,
          placedMinutesAgo: mins,
          menuItems: built.items,
          customerName: customers.length ? CUSTOMER_POOL[(i + tenantIndex) % CUSTOMER_POOL.length][0] : null,
          customerId: null,
          taxPercent: bp.branding.taxPercent,
          serviceChargePercent: bp.branding.serviceChargePercent,
        }),
      )
    })

    // Historical completed orders spread over the last 30 days for analytics.
    for (let i = 0; i < 46; i++) {
      const daysBack = i % 30
      const mins = daysBack * 60 * 24 + (i % 11) * 47 + 30
      const status: OrderStatus = i % 17 === 0 ? 'cancelled' : 'completed'
      const table = built.tables[i % built.tables.length]
      orders.push(
        buildOrder({
          orgId: bp.id,
          tableNumber: table.tableNumber,
          tableId: table.id,
          index: tenantIndex * 1000 + 100 + i,
          status,
          placedMinutesAgo: mins,
          menuItems: built.items,
          customerName: CUSTOMER_POOL[(i * 3) % CUSTOMER_POOL.length][0],
          customerId: `cust_${bp.slug}_${(i * 3) % CUSTOMER_POOL.length}`,
          channel: i % 9 === 0 ? 'takeaway' : 'dine_in',
          taxPercent: bp.branding.taxPercent,
          serviceChargePercent: bp.branding.serviceChargePercent,
        }),
      )
    }

    /* ---- reflect live orders onto tables ------------------------------ */
    orders
      .filter((o) => o.organizationId === bp.id && ['pending', 'accepted', 'preparing', 'ready', 'served'].includes(o.status))
      .forEach((o) => {
        const table = built.tables.find((t) => t.id === o.tableId)
        if (!table) return
        table.status = 'occupied'
        table.currentBill = o.total
        table.occupiedSince = o.placedAt
        table.assignedWaiterId = `waiter_${bp.slug}_${table.posX % 4}`
        table.assignedWaiterName = WAITER_POOL[table.posX % WAITER_POOL.length]
      })

    // A couple of reserved + cleaning tables so every status is represented.
    built.tables.slice(0, 3).forEach((t, i) => {
      if (t.status === 'available' && i === 0) {
        t.status = 'reserved'
      }
    })
    const cleaningTarget = built.tables.find((t) => t.status === 'available')
    if (cleaningTarget) cleaningTarget.status = 'cleaning'
    // 'waiting' was removed from TableStatus — no table should be set to it.
    // (Previously: const waitingTarget = built.tables.filter((t) => t.status === 'available')[1]
    //  if (waitingTarget) waitingTarget.status = 'waiting')
    // No-op: TableStatus no longer includes 'waiting'.
    const _unused = built.tables.filter((t) => t.status === 'available')[1]

    /* ---- service requests -------------------------------------------- */
    const requestSpec: [ServiceRequest['type'], string, ServiceRequest['status'], number][] = [
      ['water', 'T-02', 'pending', 2],
      ['request_bill', 'T-09', 'pending', 1],
      ['call_waiter', 'T-05', 'in_progress', 6],
      ['other', 'T-11', 'completed', 24],
      ['clean_table', 'T-14', 'completed', 48],
    ]
    requestSpec.forEach(([type, tableNumber, status, mins], i) => {
      const table = built.tables.find((t) => t.tableNumber === tableNumber)
      if (!table) return
      serviceRequests.push({
        id: `sr_${bp.slug}_${i}`,
        organizationId: bp.id,
        tableId: table.id,
        tableNumber,
        type,
        status,
        note: '',
        assignedToName: status === 'pending' ? null : WAITER_POOL[i % WAITER_POOL.length],
        createdAt: ago(mins),
        resolvedAt: status === 'completed' ? ago(Math.max(1, mins - 8)) : null,
      })
    })

    /* ---- reservations ------------------------------------------------ */
    const reservationSpec: [string, number, string, Reservation['status']][] = [
      ['Ananya Sharma', 4, '19:30', 'confirmed'],
      ['Rohit Kapoor', 2, '20:00', 'pending'],
      ['Meera Iyer', 8, '20:30', 'confirmed'],
      ['Devansh Gupta', 6, '21:00', 'pending'],
      ['Sneha Reddy', 3, '18:45', 'completed'],
      ['Karan Malhotra', 5, '21:30', 'cancelled'],
    ]
    reservationSpec.forEach(([name, guests, time, status], i) => {
      const table = built.tables[built.tables.length - 1 - i]
      reservations.push({
        id: `res_${bp.slug}_${i}`,
        organizationId: bp.id,
        customerName: name,
        phone: CUSTOMER_POOL[i % CUSTOMER_POOL.length][1],
        email: `${name.split(' ')[0].toLowerCase()}@example.com`,
        date: new Date().toISOString().slice(0, 10),
        time,
        guests,
        tableId: table?.id ?? null,
        tableNumber: table?.tableNumber ?? null,
        status,
        specialRequest: i === 2 ? 'Window seating if possible. Anniversary cake to be brought out at dessert.' : '',
        createdAt: ago(60 * 20 + i * 40),
      })
    })

    /* ---- inventory --------------------------------------------------- */
    const invSpec: [string, string, number, InventoryItem['unit'], number, number, string, number | null][] = [
      ['Arabica Beans (House)', 'Beverage', 15, 'kg', 5, 1450, 'Beanhouse Roasters', 40],
      ['Oat Milk (Barista)', 'Dairy alt', 2, 'l', 6, 210, 'Greenday Foods', 12],
      ['Whole Milk', 'Dairy', 24, 'l', 10, 62, 'Dairy Fresh', 4],
      ['San Marzano Tomatoes', 'Produce', 18, 'kg', 8, 280, 'Italian Imports Co', 16],
      ['Buffalo Mozzarella', 'Dairy', 4, 'kg', 3, 720, 'Dairy Fresh', 6],
      ['Wagyu Patty (150g)', 'Meat', 26, 'pcs', 15, 340, 'Prime Cuts', 9],
      ['Wild Mushroom Mix', 'Produce', 3, 'kg', 4, 560, 'Forest Harvest', 3],
      ['Fresh Truffle', 'Specialty', 0.4, 'kg', 0.3, 8200, 'Alba Delicacies', 2],
      ['Sourdough Loaf', 'Bakery', 12, 'pcs', 6, 180, 'Rise & Bake', 5],
      ['Maple Syrup (Grade A)', 'Pantry', 6, 'bottles', 3, 640, 'Vermont Traders', 90],
      ['Sea Salt Flakes', 'Pantry', 9, 'kg', 2, 320, 'Coastal Saltworks', 220],
      ['Cooking Cream', 'Dairy', 14, 'l', 6, 145, 'Dairy Fresh', 8],
      ['Cocoa Nibs', 'Pantry', 2, 'kg', 1.5, 980, 'Cacao Republic', 120],
      ['Curry Leaves', 'Produce', 1, 'kg', 1, 180, 'Local Market', 2],
      ['Basmati Rice (Aged)', 'Grains', 42, 'kg', 15, 165, 'Punjab Grains', 300],
      ['Cardamom (Green)', 'Spice', 1.2, 'kg', 0.8, 3100, 'Spice Bazaar', 180],
    ]
    invSpec.forEach(([ingredient, cat, stock, unit, threshold, unitCost, supplier, expiresInDays], i) => {
      inventory.push({
        id: `inv_${bp.slug}_${i}`,
        organizationId: bp.id,
        ingredient,
        category: cat,
        currentStock: stock,
        unit,
        lowStockThreshold: threshold,
        unitCost,
        supplier,
        expiryDate: expiresInDays === null ? null : fromNow(60 * 24 * (expiresInDays as number)),
        lastRestockedAt: ago(60 * 24 * (2 + (i % 9))),
      })
    })

    /* ---- customers --------------------------------------------------- */
    CUSTOMER_POOL.forEach(([name, phone, tier], i) => {
      const totalOrders = 3 + ((i * 7) % 42)
      const totalSpend = totalOrders * (380 + (i % 6) * 95)
      customers.push({
        id: `cust_${bp.slug}_${i}`,
        organizationId: bp.id,
        name,
        phone,
        email: `${name.split(' ')[0].toLowerCase()}.${name.split(' ')[1]?.toLowerCase() ?? ''}@example.com`,
        totalOrders,
        totalSpend,
        loyaltyPoints: Math.round(totalSpend / 10),
        tier,
        visitCount: totalOrders + ((i * 3) % 12),
        lastVisitAt: ago(60 * 24 * (i % 26)),
        preferences: i % 3 === 0 ? ['Vegetarian', 'Window seat'] : i % 3 === 1 ? ['Extra spicy'] : [],
        notes: i === 2 ? 'Regular — always orders the tasting menu. Prefers the corner booth.' : '',
        marketingConsent: i % 4 !== 3,
        createdAt: ago(60 * 24 * (30 + i * 18)),
      })
    })

    /* ---- billing ----------------------------------------------------- */
    const planPrice = bp.planId === 'starter' ? 999 : bp.planId === 'growth' ? 2499 : 5999
    for (let i = 0; i < 6; i++) {
      invoices.push({
        id: `inv_doc_${bp.slug}_${i}`,
        organizationId: bp.id,
        invoiceNumber: `BF-${2026}-${String(vectorIndex(bp.slug) * 100 + 40 + i)}`,
        issuedAt: ago(60 * 24 * (30 * i + 3)),
        amount: planPrice,
        status: i === 0 ? 'pending' : 'paid',
        planId: bp.planId,
        periodLabel: new Date(Date.now() - 60 * 24 * 30 * i).toLocaleDateString('en-IN', {
          month: 'long',
          year: 'numeric',
        }),
      })
    }
    paymentMethods.push({
      id: `pm_${bp.slug}`,
      organizationId: bp.id,
      brand: 'visa',
      last4: String(4100 + vectorIndex(bp.slug)),
      expiry: '08/29',
      isDefault: true,
    })

    /* ---- audit log --------------------------------------------------- */
    const auditSpec: [string, string, string, number][] = [
      ['auth.login', 'session', 'Owner signed in from a new device', 14],
      ['order.status_changed', 'order', 'Order BF-1042 moved to Preparing', 26],
      ['menu.item_updated', 'menu_item', 'Updated price for Truffle Mushroom Risotto', 90],
      ['plan.changed', 'subscription', `Subscription set to ${bp.planId}`, 60 * 24 * 12],
      ['employee.role_changed', 'membership', 'Rahul Mehta promoted to Manager', 60 * 24 * 20],
      ['table.qr_regenerated', 'table', 'Regenerated QR for T-04', 60 * 24 * 33],
      ['billing.refund_issued', 'invoice', 'Goodwill credit issued for a cancelled order', 60 * 24 * 45],
    ]
    auditSpec.forEach(([action, entityType, summary, mins], i) => {
      auditLogs.push({
        id: `aud_${bp.slug}_${i}`,
        organizationId: bp.id,
        actorId: 'user_owner',
        actorName: 'Aarav Mehta',
        actorRole: 'owner',
        action,
        entityType,
        entityId: null,
        summary,
        ipAddress: `49.36.${10 + i}.${100 + i * 7}`,
        createdAt: ago(mins),
      })
    })

    /* ---- notifications ----------------------------------------------- */
    const notifSpec: [AppNotification['kind'], string, string, boolean, number, string][] = [
      ['order', 'New QR order · T-02', 'Order BF-1001 placed with 3 items · ₹1,180', false, 2, '/app/orders'],
      ['service_request', 'Water refill requested · T-02', 'Guest pressed the service button', false, 2, '/app/tables'],
      ['inventory', 'Oat Milk below threshold', 'Only 2L left — reorder suggested', false, 45, '/app/inventory'],
      ['system', 'Reservation confirmed · 20:30', 'Meera Iyer for 8 guests', true, 120, '/app/reservations'],
      ['subscription', 'Renewal in 12 days', 'Growth plan renews automatically', true, 60 * 20, '/app/billing'],
      ['system', 'Daily analytics digest ready', 'Yesterday closed at +18.4% vs the week before', true, 60 * 9, '/app/analytics'],
    ]
    notifSpec.forEach(([kind, title, body, read, mins, href], i) => {
      notifications.push({
        id: `ntf_${bp.slug}_${i}`,
        organizationId: bp.id,
        kind,
        title,
        body,
        read,
        createdAt: ago(mins),
        href,
      })
    })
  })

  /* Link live orders to real customer ids where possible. */
  customers.forEach((c) => {
    orders
      .filter((o) => o.organizationId === c.organizationId && o.customerName === c.name)
      .forEach((o) => {
        o.customerId = c.id
      })
  })

  return {
    profiles,
    organizations,
    memberships,
    categories,
    menuItems,
    tables,
    orders,
    serviceRequests,
    reservations,
    inventory,
    customers,
    invoices,
    paymentMethods,
    auditLogs,
    notifications,
  }
}

function vectorIndex(slug: string): number {
  return slug === 'urban-bean-cafe' ? 1 : slug === 'spice-route' ? 2 : 3
}

export const DEMO_OWNER_ID = 'user_owner'
export const DEMO_SUPER_ADMIN_ID = 'user_super'

export { uid }
