export type Category = 'regular' | 'outdoor' | 'sonaton';
export type SonatonSide = 'both' | 'bride' | 'groom' | 'wedding';

export type PackageItem = {
  tier: string;
  name: string;
  price: number;
  badge?: string;
  coverage: string;
  crew: string[];
  deliverables: string[];
  physical: string[];
};

export const regularPackages: PackageItem[] = [
  {
    tier: 'Essential',
    name: 'Regular Basic',
    price: 15000,
    coverage: '4 hours coverage',
    crew: ['1 Photographer', '1 Cinematographer', 'Drone operator not included'],
    deliverables: ['All usable edited photos', '1 Reel', '1 Full Video', '1 Trailer'],
    physical: ['Photobook not included', 'Pendrive not included'],
  },
  {
    tier: 'Best Value',
    name: 'Regular Standard',
    price: 23000,
    badge: 'Most Popular',
    coverage: '6 hours coverage',
    crew: ['2 Photographers', '1 Cinematographer', 'Drone operator not included'],
    deliverables: ['All usable edited photos', '1 Reel', '1 Full Video', '1 Trailer'],
    physical: ['Photobook not included', 'Pendrive not included'],
  },
  {
    tier: 'Signature',
    name: 'Regular Storytelling',
    price: 55000,
    coverage: '6 hours coverage',
    crew: ['1 Candid Photographer', '1 Senior Photographer', '2 Cinematographers'],
    deliverables: ['All usable edited photos', '1 Reel', '1 Full Video', '1 Trailer'],
    physical: ['Premium album options available', 'Pendrive available'],
  },
];

export const outdoorPackages: PackageItem[] = [
  {
    tier: 'Budget / Essential',
    name: 'Outdoor Essentials',
    price: 13000,
    coverage: '2–4 hours outdoor coverage',
    crew: ['1 Photographer', '1 Senior Cinematographer', 'Drone operator not included'],
    deliverables: ['Approx. 100 selected edited photos', '1 Trailer'],
    physical: ['Photobook not included', 'Pendrive not included'],
  },
  {
    tier: 'Best Value',
    name: 'Outdoor Cinematic',
    price: 23000,
    badge: 'Most Popular',
    coverage: '4–6 hours outdoor coverage',
    crew: ['1 Senior Photographer', '1 Senior Cinematographer', '1 Drone Operator'],
    deliverables: ['All usable edited photos', '1 Full Video', '1 Trailer'],
    physical: ['Photobook not included', 'Pendrive not included'],
  },
  {
    tier: 'Premium / Signature',
    name: 'Outdoor Signature',
    price: 47000,
    coverage: '6–8 hours outdoor coverage',
    crew: ['1 Candid Photographer', '1 Senior Photographer', '1 Senior Cinematographer', '1 Drone Operator'],
    deliverables: ['All usable edited photos', '1 Reel', '1 Full Video', '1 Trailer'],
    physical: ['Exclusive photobook available', 'Pendrive available'],
  },
];

export const sonatonPackages: Record<SonatonSide, PackageItem[]> = {
  both: [
    {
      tier: 'Signature',
      name: 'Sonaton Both Side Signature',
      price: 124000,
      coverage: 'Bride + groom side traditional wedding coverage',
      crew: ['1 Photographer + 1 Cinematographer on each side'],
      deliverables: ['Pre-Wedding', 'Holud for Bride', 'Holud for Groom', 'Bride & Groom side rituals', 'Reception'],
      physical: ['Standard Photobook', 'Pendrive'],
    },
    {
      tier: 'Prestige',
      name: 'Sonaton Both Side Prestige',
      price: 184000,
      badge: 'Most Popular',
      coverage: 'Extended both-side multi-event coverage',
      crew: ['2 Photographers', '1 Cinematographer', '1 Drone Operator on each side where applicable'],
      deliverables: ['Pre-Wedding', 'Holud for Bride', 'Holud for Groom', 'Bride & Groom side rituals', 'Reception'],
      physical: ['Standard Photobook', 'Pendrive'],
    },
    {
      tier: 'Storytelling',
      name: 'Sonaton Both Side Storytelling',
      price: 339000,
      coverage: 'Complete both-side wedding storytelling',
      crew: ['2 Photographers', '1–2 Cinematographers', '1 Drone Operator on each side where applicable'],
      deliverables: ['Engagement', 'Pre-Wedding', 'Mehendi', 'Colour Fest', 'Holud for Bride', 'Holud for Groom', 'Bride & Groom side rituals', 'Reception', 'Post-Wedding'],
      physical: ['Premium Photobook', 'Pendrive'],
    },
  ],
  bride: [
    {
      tier: 'Signature',
      name: 'Sonaton Bride Side Signature',
      price: 44000,
      coverage: 'Bride-side focused traditional wedding coverage',
      crew: ['1 Photographer', '1 Cinematographer'],
      deliverables: ['Holud for Bride', 'Bride-side rituals', 'Wedding Night / Bidaay'],
      physical: ['Photobook not included', 'Pendrive not included'],
    },
    {
      tier: 'Prestige',
      name: 'Sonaton Bride Side Prestige',
      price: 89000,
      badge: 'Most Popular',
      coverage: 'Extended bride-side multi-event coverage',
      crew: ['2 Photographers', '1 Cinematographer', '1 Drone Operator'],
      deliverables: ['Holud for Bride', 'Bride-side rituals', 'Wedding Night / Bidaay'],
      physical: ['Standard Photobook', 'Pendrive'],
    },
    {
      tier: 'Storytelling',
      name: 'Sonaton Bride Side Storytelling',
      price: 219000,
      coverage: 'Complete bride-side storytelling coverage',
      crew: ['2 Photographers', '1–2 Cinematographers', '1 Drone Operator'],
      deliverables: ['Pre-Wedding', 'Mehendi', 'Colour Fest', 'Holud for Bride', 'Bride-side rituals', 'Wedding Night / Bidaay'],
      physical: ['Exclusive Photobook', 'Pendrive'],
    },
  ],
  groom: [
    {
      tier: 'Signature',
      name: 'Sonaton Groom Side Signature',
      price: 63000,
      coverage: 'Groom-side focused traditional wedding coverage',
      crew: ['1 Photographer', '1 Cinematographer'],
      deliverables: ['Holud for Groom', 'Groom-side rituals', 'Reception / Vat Kapor'],
      physical: ['Photobook not included', 'Pendrive not included'],
    },
    {
      tier: 'Prestige',
      name: 'Sonaton Groom Side Prestige',
      price: 134000,
      badge: 'Most Popular',
      coverage: 'Extended groom-side multi-event coverage',
      crew: ['2 Photographers', '1 Cinematographer', '1 Drone Operator'],
      deliverables: ['Holud for Groom', 'Groom-side rituals', 'Reception / Vat Kapor'],
      physical: ['Standard Photobook', 'Pendrive'],
    },
    {
      tier: 'Storytelling',
      name: 'Sonaton Groom Side Storytelling',
      price: 209000,
      coverage: 'Complete groom-side storytelling coverage',
      crew: ['2 Photographers', '2 Cinematographers', '1 Drone Operator'],
      deliverables: ['Pre-Wedding', 'Holud for Groom', 'Groom-side rituals', 'Reception / Vat Kapor'],
      physical: ['Exclusive Photobook', 'Pendrive'],
    },
  ],
  wedding: [
    {
      tier: 'Signature',
      name: 'Sonaton Wedding Day Signature',
      price: 34000,
      coverage: 'Wedding-day focused ceremonial coverage',
      crew: ['1 Photographer', '1 Cinematographer'],
      deliverables: ['Odhivash Outdoor', 'Home Rituals', 'Wedding Night'],
      physical: ['Photobook not included', 'Pendrive not included'],
    },
    {
      tier: 'Prestige',
      name: 'Sonaton Wedding Day Prestige',
      price: 55000,
      badge: 'Most Popular',
      coverage: 'Extended wedding-day coverage',
      crew: ['2 Photographers', '1 Cinematographer', '1 Drone Operator'],
      deliverables: ['Odhivash Outdoor', 'Home Rituals', 'Wedding Night'],
      physical: ['Standard Photobook', 'Pendrive'],
    },
    {
      tier: 'Storytelling',
      name: 'Sonaton Wedding Day Storytelling',
      price: 109000,
      coverage: 'Premium wedding-day storytelling coverage',
      crew: ['2 Photographers', '2 Cinematographers', '1 Drone Operator'],
      deliverables: ['Pre-Wedding', 'Odhivash Outdoor', 'Home Rituals', 'Wedding Night'],
      physical: ['Exclusive Photobook', 'Pendrive'],
    },
  ],
};


export const packageId=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]+/g,"-");
export const allPackages=[...regularPackages,...outdoorPackages,...Object.values(sonatonPackages).flat()];
