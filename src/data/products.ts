export interface Product {
  id: string;
  name: string;
  reference: string;
  brand: string;
  category: string;
  compatibleCars: string[];
  price: number;
  image: string;
  inStock: boolean;
  popular?: boolean;
}

export const products: Product[] = [
  {
    id: "1",
    name: "Plaquettes de frein avant",
    reference: "BRK-001-REN",
    brand: "Renault",
    category: "Freinage",
    compatibleCars: ["Renault Clio", "Renault Megane", "Renault Scenic"],
    price: 89.99,
    image: "/placeholder.svg",
    inStock: true,
    popular: true,
  },
  {
    id: "2",
    name: "Filtre à huile",
    reference: "FLT-002-PEU",
    brand: "Peugeot",
    category: "Filtration",
    compatibleCars: ["Peugeot 208", "Peugeot 308", "Peugeot 3008"],
    price: 15.50,
    image: "/placeholder.svg",
    inStock: true,
  },
  {
    id: "3",
    name: "Disque de frein arrière",
    reference: "BRK-003-CIT",
    brand: "Citroën",
    category: "Freinage",
    compatibleCars: ["Citroën C3", "Citroën C4", "Citroën Berlingo"],
    price: 125.00,
    image: "/placeholder.svg",
    inStock: true,
    popular: true,
  },
  {
    id: "4",
    name: "Courroie de distribution",
    reference: "ENG-004-NIS",
    brand: "Nissan",
    category: "Moteur",
    compatibleCars: ["Nissan Micra", "Nissan Qashqai", "Nissan X-Trail"],
    price: 75.00,
    image: "/placeholder.svg",
    inStock: false,
  },
  {
    id: "5",
    name: "Kit d'embrayage",
    reference: "CLT-005-REN",
    brand: "Renault",
    category: "Transmission",
    compatibleCars: ["Renault Clio", "Renault Twingo"],
    price: 245.00,
    image: "/placeholder.svg",
    inStock: true,
  },
  {
    id: "6",
    name: "Filtre à air",
    reference: "FLT-006-PEU",
    brand: "Peugeot",
    category: "Filtration",
    compatibleCars: ["Peugeot 208", "Peugeot 2008"],
    price: 22.50,
    image: "/placeholder.svg",
    inStock: true,
  },
  {
    id: "7",
    name: "Amortisseur avant",
    reference: "SUS-007-ISU",
    brand: "Isuzu",
    category: "Suspension",
    compatibleCars: ["Isuzu D-Max", "Isuzu MU-X"],
    price: 180.00,
    image: "/placeholder.svg",
    inStock: true,
  },
  {
    id: "8",
    name: "Rotule de suspension",
    reference: "SUS-008-CIT",
    brand: "Citroën",
    category: "Suspension",
    compatibleCars: ["Citroën C3", "Citroën C4 Picasso"],
    price: 45.00,
    image: "/placeholder.svg",
    inStock: true,
    popular: true,
  },
  {
    id: "9",
    name: "Bougie d'allumage (lot de 4)",
    reference: "ENG-009-REN",
    brand: "Renault",
    category: "Moteur",
    compatibleCars: ["Renault Clio", "Renault Megane"],
    price: 35.00,
    image: "/placeholder.svg",
    inStock: true,
  },
  {
    id: "10",
    name: "Radiateur de refroidissement",
    reference: "RAD-010-PEU",
    brand: "Peugeot",
    category: "Refroidissement",
    compatibleCars: ["Peugeot 308", "Peugeot 508"],
    price: 320.00,
    image: "/placeholder.svg",
    inStock: false,
  },
  {
    id: "11",
    name: "Plaquettes de frein arrière",
    reference: "BRK-011-NIS",
    brand: "Nissan",
    category: "Freinage",
    compatibleCars: ["Nissan Juke", "Nissan Qashqai"],
    price: 65.00,
    image: "/placeholder.svg",
    inStock: true,
  },
  {
    id: "12",
    name: "Kit de distribution complet",
    reference: "ENG-012-REN",
    brand: "Renault",
    category: "Moteur",
    compatibleCars: ["Renault Megane", "Renault Scenic"],
    price: 185.00,
    image: "/placeholder.svg",
    inStock: true,
  },
];

export const brands = ["Renault", "Peugeot", "Citroën", "Nissan", "Isuzu"];
export const categories = ["Freinage", "Filtration", "Moteur", "Transmission", "Suspension", "Refroidissement"];
