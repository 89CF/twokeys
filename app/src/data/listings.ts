import type { TemplateKey } from "@/lib/templates";

/** Static, fictional demo listings for the two fake marketplaces (DemoAuto: cars, DemoRent: equipment rental). */
export interface Listing {
  id: string;
  site: "auto" | "rent";
  template: TemplateKey;
  title: string;
  subtitle: string;
  /** full price, PLN (DemoRent: price per day) */
  price: number;
  /** suggested deposit / security deposit, PLN (demo rate 1 USDC ≈ 1 PLN) */
  deposit: number;
  location: string;
  postedAgo: string;
  seller: { name: string; memberSince: string };
  specs: { label: string; value: string }[];
  highlights: string[];
  description: string;
  art: { from: string; to: string; body: string; accent: string; variant: string };
}

export const LISTINGS: Listing[] = [
  // ---------------- DemoAuto ----------------
  {
    id: "da-1042",
    site: "auto",
    template: "deposit",
    title: "Skoda Octavia Combi 2.0 TDI",
    subtitle: "2019 · 128,000 km · Diesel · Manual",
    price: 58900,
    deposit: 1000,
    location: "Kraków, Podgórze",
    postedAgo: "2 hours ago",
    seller: { name: "Marek K.", memberSince: "2017" },
    specs: [
      { label: "Year", value: "2019" },
      { label: "Mileage", value: "128,000 km" },
      { label: "Fuel", value: "Diesel" },
      { label: "Gearbox", value: "Manual" },
      { label: "Power", value: "150 hp" },
      { label: "Body", value: "Estate" },
    ],
    highlights: ["First owner", "Full service history", "Accident-free"],
    description:
      "Family estate in very good condition, serviced at an authorised workshop every 15,000 km. Two sets of tyres, " +
      "tow bar, heated seats. Can be seen in Kraków on weekdays after 17:00.",
    art: { from: "#0f172a", to: "#1e3a5f", body: "#cbd5e1", accent: "#38bdf8", variant: "estate" },
  },
  {
    id: "da-2210",
    site: "auto",
    template: "deposit",
    title: "Toyota Corolla 1.8 Hybrid",
    subtitle: "2021 · 54,300 km · Hybrid · Automatic",
    price: 89500,
    deposit: 1000,
    location: "Warszawa, Mokotów",
    postedAgo: "yesterday",
    seller: { name: "Anna W.", memberSince: "2020" },
    specs: [
      { label: "Year", value: "2021" },
      { label: "Mileage", value: "54,300 km" },
      { label: "Fuel", value: "Hybrid" },
      { label: "Gearbox", value: "Automatic" },
      { label: "Power", value: "122 hp" },
      { label: "Body", value: "Hatchback" },
    ],
    highlights: ["Polish dealer car", "Warranty until 2026", "Garage kept"],
    description:
      "Economical city car, averages 4.3 l/100 km. Adaptive cruise control, lane assist, reversing camera. " +
      "Selling because of a company car.",
    art: { from: "#1a0b2e", to: "#4c1d95", body: "#f8fafc", accent: "#a78bfa", variant: "hatch" },
  },
  {
    id: "da-3307",
    site: "auto",
    template: "deposit",
    title: "Volkswagen Golf VII 1.5 TSI",
    subtitle: "2018 · 97,800 km · Petrol · Manual",
    price: 52000,
    deposit: 800,
    location: "Wrocław, Krzyki",
    postedAgo: "3 days ago",
    seller: { name: "Piotr S.", memberSince: "2015" },
    specs: [
      { label: "Year", value: "2018" },
      { label: "Mileage", value: "97,800 km" },
      { label: "Fuel", value: "Petrol" },
      { label: "Gearbox", value: "Manual" },
      { label: "Power", value: "130 hp" },
      { label: "Body", value: "Hatchback" },
    ],
    highlights: ["New brakes", "Apple CarPlay", "2 keys"],
    description: "Well maintained, non-smoker. Recently replaced brake discs and pads. Ready to drive.",
    art: { from: "#3f0d12", to: "#a71d31", body: "#fee2e2", accent: "#fb7185", variant: "hatch" },
  },
  {
    id: "da-4581",
    site: "auto",
    template: "deposit",
    title: "Mazda CX-5 2.5 Skyactiv-G AWD",
    subtitle: "2020 · 71,000 km · Petrol · Automatic",
    price: 104900,
    deposit: 1000,
    location: "Gdańsk, Oliwa",
    postedAgo: "5 days ago",
    seller: { name: "Kasia M.", memberSince: "2019" },
    specs: [
      { label: "Year", value: "2020" },
      { label: "Mileage", value: "71,000 km" },
      { label: "Fuel", value: "Petrol" },
      { label: "Gearbox", value: "Automatic" },
      { label: "Power", value: "194 hp" },
      { label: "Body", value: "SUV" },
    ],
    highlights: ["All-wheel drive", "Leather interior", "Head-up display"],
    description: "Top trim, metallic paint, premium audio. Winter tyres included. Viewing in Gdańsk by appointment.",
    art: { from: "#022c22", to: "#065f46", body: "#d1fae5", accent: "#14f195", variant: "suv" },
  },
  {
    id: "da-5120",
    site: "auto",
    template: "deposit",
    title: "Fiat 500 1.2 Lounge",
    subtitle: "2016 · 83,500 km · Petrol · Manual",
    price: 27900,
    deposit: 500,
    location: "Poznań, Jeżyce",
    postedAgo: "1 week ago",
    seller: { name: "Ola B.", memberSince: "2021" },
    specs: [
      { label: "Year", value: "2016" },
      { label: "Mileage", value: "83,500 km" },
      { label: "Fuel", value: "Petrol" },
      { label: "Gearbox", value: "Manual" },
      { label: "Power", value: "69 hp" },
      { label: "Body", value: "City car" },
    ],
    highlights: ["Panoramic roof", "Low insurance", "Perfect first car"],
    description: "Charming city car, easy to park, cheap to run. Small scratch on rear bumper (see photos).",
    art: { from: "#2a1a04", to: "#b45309", body: "#fef3c7", accent: "#fbbf24", variant: "city" },
  },

  // ---------------- DemoRent ----------------
  {
    id: "dr-201",
    site: "rent",
    template: "rental",
    title: "Full-frame mirrorless camera kit",
    subtitle: "24 MP body · 24–70 mm f/2.8 lens · 2 batteries",
    price: 120,
    deposit: 800,
    location: "Kraków, Kazimierz",
    postedAgo: "1 hour ago",
    seller: { name: "Kuba F.", memberSince: "2019" },
    specs: [
      { label: "Sensor", value: "Full frame, 24 MP" },
      { label: "Lens", value: "24–70 mm f/2.8" },
      { label: "Video", value: "4K 60p" },
      { label: "Batteries", value: "2 + charger" },
      { label: "Pickup", value: "Kazimierz" },
      { label: "Min. rental", value: "1 day" },
    ],
    highlights: ["Cleaned sensor", "64 GB card included", "Padded bag"],
    description: "Great for weddings and travel. Pick up and return in person; the security deposit is held by Kapora, not by me.",
    art: { from: "#111827", to: "#374151", body: "#e5e7eb", accent: "#facc15", variant: "camera" },
  },
  {
    id: "dr-202",
    site: "rent",
    template: "rental",
    title: "14-inch creator laptop",
    subtitle: "M-class chip · 32 GB RAM · 1 TB SSD",
    price: 90,
    deposit: 1000,
    location: "Warszawa, Śródmieście",
    postedAgo: "3 hours ago",
    seller: { name: "Ola N.", memberSince: "2021" },
    specs: [
      { label: "Memory", value: "32 GB" },
      { label: "Storage", value: "1 TB SSD" },
      { label: "Display", value: "14\" 120 Hz" },
      { label: "Battery", value: "~15 h" },
      { label: "Charger", value: "Included" },
      { label: "Min. rental", value: "2 days" },
    ],
    highlights: ["Video editing suite installed", "Wiped after every rental", "Sleeve included"],
    description: "Ideal for a short project or travel. The laptop is reset to factory state when returned.",
    art: { from: "#0f172a", to: "#1e3a8a", body: "#cbd5e1", accent: "#38bdf8", variant: "laptop" },
  },
  {
    id: "dr-203",
    site: "rent",
    template: "rental",
    title: "Camera drone with 3 batteries",
    subtitle: "4K gimbal · 34 min flight · obstacle sensing",
    price: 150,
    deposit: 1000,
    location: "Gdańsk, Wrzeszcz",
    postedAgo: "yesterday",
    seller: { name: "Paweł R.", memberSince: "2018" },
    specs: [
      { label: "Camera", value: "4K 60p, 3-axis" },
      { label: "Flight time", value: "34 min" },
      { label: "Range", value: "10 km" },
      { label: "Weight", value: "249 g" },
      { label: "Batteries", value: "3" },
      { label: "Min. rental", value: "1 day" },
    ],
    highlights: ["Under 250 g class", "ND filter set", "Short briefing on pickup"],
    description: "Light enough for most open-category flights. Please check local rules before flying.",
    art: { from: "#052e16", to: "#166534", body: "#f1f5f9", accent: "#a3e635", variant: "drone" },
  },
  {
    id: "dr-204",
    site: "rent",
    template: "rental",
    title: "Portrait lens 85 mm f/1.4",
    subtitle: "Full-frame mount · weather sealed",
    price: 45,
    deposit: 400,
    location: "Wrocław, Nadodrze",
    postedAgo: "4 days ago",
    seller: { name: "Iga W.", memberSince: "2020" },
    specs: [
      { label: "Focal length", value: "85 mm" },
      { label: "Aperture", value: "f/1.4" },
      { label: "Mount", value: "Full-frame E" },
      { label: "Weight", value: "820 g" },
      { label: "Hood", value: "Included" },
      { label: "Min. rental", value: "1 day" },
    ],
    highlights: ["Creamy bokeh", "UV filter", "Front and rear caps"],
    description: "My favourite portrait lens. Comes with a filter and a soft pouch.",
    art: { from: "#2e1065", to: "#6d28d9", body: "#ede9fe", accent: "#f0abfc", variant: "lens" },
  },
  {
    id: "dr-205",
    site: "rent",
    template: "rental",
    title: "Portable 4K projector",
    subtitle: "1,500 lumens · built-in speaker · screen included",
    price: 70,
    deposit: 600,
    location: "Poznań, Łazarz",
    postedAgo: "1 week ago",
    seller: { name: "Marta K.", memberSince: "2017" },
    specs: [
      { label: "Resolution", value: "4K" },
      { label: "Brightness", value: "1,500 lm" },
      { label: "Screen", value: "100\" foldable" },
      { label: "Inputs", value: "HDMI, USB-C" },
      { label: "Audio", value: "2 × 10 W" },
      { label: "Min. rental", value: "1 day" },
    ],
    highlights: ["Garden movie nights", "Tripod included", "Easy setup"],
    description: "Perfect for an outdoor movie night or a presentation. Fits in a backpack.",
    art: { from: "#3f1d0b", to: "#c2410c", body: "#fff7ed", accent: "#fde047", variant: "projector" },
  },
];

export function getListing(id: string | null | undefined): Listing | undefined {
  return id ? LISTINGS.find((l) => l.id === id) : undefined;
}

export function listingsFor(site: Listing["site"]): Listing[] {
  return LISTINGS.filter((l) => l.site === site);
}

export function fmtPrice(pln: number): string {
  return `${pln.toLocaleString("en-US")} PLN`;
}
