// backend/src/data/listingTypes.js
//
// Catalog of content types the "AI Listing Writer" extension can generate
// a title + description for. Each entry drives the system prompt built in
// services/ListingContentService.js.
//
// category: groups types in the extension's UI (category select -> type select)
// label: shown in the UI
// promptGuidance: type-specific instructions folded into the AI system prompt
// constraints: optional hard limits (used for SEO meta types) enforced in the prompt

const CATEGORIES = [
  { id: 'real-estate', label: { en: 'Real Estate', tr: 'Emlak' } },
  { id: 'vehicle', label: { en: 'Vehicles', tr: 'Vasıta' } },
  { id: 'ecommerce', label: { en: 'E-commerce Product', tr: 'E-ticaret Ürünü' } },
  { id: 'job', label: { en: 'Job Posting', tr: 'İş İlanı' } },
  { id: 'service', label: { en: 'Service / Freelance', tr: 'Hizmet / Serbest Çalışma' } },
  { id: 'seo', label: { en: 'SEO Meta', tr: 'SEO Meta' } },
  { id: 'secondhand', label: { en: 'Second-hand Item', tr: 'İkinci El Eşya' } }
];

const TYPES = [
  // ---- Real Estate ----
  { id: 'sale-apartment', category: 'real-estate', label: { en: 'Apartment for Sale', tr: 'Satılık Daire' },
    promptGuidance: 'Write a real estate listing for an apartment for sale. Emphasize room count (e.g. 3+1), square meters, floor, building age, heating type, and neighborhood if provided.' },
  { id: 'rent-apartment', category: 'real-estate', label: { en: 'Apartment for Rent', tr: 'Kiralık Daire' },
    promptGuidance: 'Write a real estate listing for an apartment for rent. Emphasize monthly rent, deposit, room count, furnished status, and neighborhood if provided.' },
  { id: 'sale-villa', category: 'real-estate', label: { en: 'Villa for Sale', tr: 'Satılık Villa' },
    promptGuidance: 'Write a real estate listing for a villa for sale. Emphasize land size, living area, pool/garden, privacy, and luxury features if provided.' },
  { id: 'rent-villa', category: 'real-estate', label: { en: 'Villa for Rent', tr: 'Kiralık Villa' },
    promptGuidance: 'Write a real estate listing for a villa for rent (long-term or seasonal). Emphasize rent price, availability period, and amenities if provided.' },
  { id: 'sale-land', category: 'real-estate', label: { en: 'Land for Sale', tr: 'Satılık Arsa' },
    promptGuidance: 'Write a real estate listing for land/plot for sale. Emphasize zoning status (imar durumu), plot size, frontage, and development potential if provided.' },
  { id: 'sale-office', category: 'real-estate', label: { en: 'Office/Shop for Sale', tr: 'Satılık İşyeri' },
    promptGuidance: 'Write a real estate listing for a commercial office or shop for sale. Emphasize location foot traffic, size, and suitability for business type if provided.' },
  { id: 'rent-office', category: 'real-estate', label: { en: 'Office/Shop for Rent', tr: 'Kiralık İşyeri' },
    promptGuidance: 'Write a real estate listing for a commercial office or shop for rent. Emphasize monthly rent, size, and suitability for business type if provided.' },
  { id: 'rent-summerhouse', category: 'real-estate', label: { en: 'Summer House for Rent', tr: 'Kiralık Yazlık' },
    promptGuidance: 'Write a listing for a seasonal/vacation home rental. Emphasize proximity to the sea/nature, weekly or monthly price, and holiday appeal.' },
  { id: 'sale-building', category: 'real-estate', label: { en: 'Building for Sale', tr: 'Satılık Bina' },
    promptGuidance: 'Write a real estate listing for an entire building for sale. Emphasize number of floors/units, total square meters, and investment potential if provided.' },
  { id: 'business-transfer', category: 'real-estate', label: { en: 'Business for Transfer (Devren)', tr: 'Devren Satılık İşyeri' },
    promptGuidance: 'Write a listing for a running business being sold/transferred with its lease (devren satılık). Emphasize the type of business, monthly turnover/rent if provided, and reason for transfer only if explicitly given.' },

  // ---- Vehicles ----
  { id: 'sale-car', category: 'vehicle', label: { en: 'Car for Sale', tr: 'Satılık Otomobil' },
    promptGuidance: 'Write a vehicle listing for a car for sale. Emphasize brand/model, year, mileage, fuel type, transmission, and condition if provided.' },
  { id: 'sale-motorcycle', category: 'vehicle', label: { en: 'Motorcycle for Sale', tr: 'Satılık Motosiklet' },
    promptGuidance: 'Write a vehicle listing for a motorcycle for sale. Emphasize brand/model, engine size (cc), year, mileage, and condition if provided.' },
  { id: 'sale-commercial-vehicle', category: 'vehicle', label: { en: 'Commercial Vehicle for Sale', tr: 'Satılık Ticari Araç' },
    promptGuidance: 'Write a vehicle listing for a commercial vehicle (van, truck, pickup) for sale. Emphasize payload capacity, mileage, maintenance history, and usage if provided.' },
  { id: 'rent-car', category: 'vehicle', label: { en: 'Car Rental Offer', tr: 'Kiralık Araç' },
    promptGuidance: 'Write a car rental listing. Emphasize daily/weekly price, included km, deposit, and vehicle features if provided.' },

  // ---- E-commerce Product ----
  { id: 'product-clothing', category: 'ecommerce', label: { en: 'Clothing & Accessories', tr: 'Giyim & Aksesuar' },
    promptGuidance: 'Write an e-commerce product listing for a clothing/accessory item. Emphasize material, size options, fit, and style if provided.' },
  { id: 'product-electronics', category: 'ecommerce', label: { en: 'Electronics', tr: 'Elektronik' },
    promptGuidance: 'Write an e-commerce product listing for an electronics item. Emphasize key specs, warranty, and what problem the product solves for the buyer.' },
  { id: 'product-home', category: 'ecommerce', label: { en: 'Home & Living', tr: 'Ev & Yaşam' },
    promptGuidance: 'Write an e-commerce product listing for a home/living item. Emphasize dimensions, material, and how it fits into a home if provided.' },
  { id: 'product-beauty', category: 'ecommerce', label: { en: 'Beauty & Personal Care', tr: 'Kozmetik & Kişisel Bakım' },
    promptGuidance: 'Write an e-commerce product listing for a beauty/personal care item. Emphasize ingredients, skin/hair type suitability, and benefits if provided. Do not make medical claims.' },
  { id: 'product-furniture', category: 'ecommerce', label: { en: 'Furniture', tr: 'Mobilya' },
    promptGuidance: 'Write an e-commerce product listing for a furniture item. Emphasize dimensions, material, assembly requirements, and style if provided.' },
  { id: 'product-baby', category: 'ecommerce', label: { en: 'Baby & Kids', tr: 'Anne & Bebek' },
    promptGuidance: 'Write an e-commerce product listing for a baby/kids item. Emphasize safety, age range, and material if provided.' },
  { id: 'product-sports', category: 'ecommerce', label: { en: 'Sports & Outdoor', tr: 'Spor & Outdoor' },
    promptGuidance: 'Write an e-commerce product listing for a sports/outdoor item. Emphasize activity type, material/durability, and size if provided.' },
  { id: 'product-books-hobby', category: 'ecommerce', label: { en: 'Books & Hobby', tr: 'Kitap & Hobi' },
    promptGuidance: 'Write an e-commerce product listing for a book or hobby item. Emphasize genre/topic, condition, and edition if provided.' },
  { id: 'product-jewelry', category: 'ecommerce', label: { en: 'Jewelry & Watches', tr: 'Takı & Saat' },
    promptGuidance: 'Write an e-commerce product listing for a jewelry/watch item. Emphasize material (gold karat, stone), craftsmanship, and occasion if provided.' },
  { id: 'product-toys', category: 'ecommerce', label: { en: 'Toys & Games', tr: 'Oyuncak & Oyun' },
    promptGuidance: 'Write an e-commerce product listing for a toy/game item. Emphasize age range, educational or fun value, and safety if provided.' },

  // ---- Job Posting ----
  { id: 'job-fulltime', category: 'job', label: { en: 'Full-Time Job Posting', tr: 'Tam Zamanlı İş İlanı' },
    promptGuidance: 'Write a full-time job posting. Emphasize role responsibilities, required qualifications, and work location if provided. Keep tone professional and inclusive.' },
  { id: 'job-parttime', category: 'job', label: { en: 'Part-Time Job Posting', tr: 'Yarı Zamanlı İş İlanı' },
    promptGuidance: 'Write a part-time job posting. Emphasize schedule flexibility, hourly/shift structure, and required qualifications if provided.' },
  { id: 'job-internship', category: 'job', label: { en: 'Internship Posting', tr: 'Stajyer İlanı' },
    promptGuidance: 'Write an internship posting aimed at students/new graduates. Emphasize learning opportunities, mentorship, and duration if provided.' },
  { id: 'job-remote', category: 'job', label: { en: 'Remote Job Posting', tr: 'Uzaktan (Remote) İş İlanı' },
    promptGuidance: 'Write a remote job posting. Emphasize timezone/availability expectations, required tools/skills, and communication style if provided.' },

  // ---- Service / Freelance ----
  { id: 'service-cleaning', category: 'service', label: { en: 'Cleaning Service', tr: 'Temizlik Hizmeti' },
    promptGuidance: 'Write a listing offering a home/office cleaning service. Emphasize service scope, pricing basis, and service area if provided.' },
  { id: 'service-moving', category: 'service', label: { en: 'Moving / Relocation Service', tr: 'Nakliyat / Evden Eve Taşıma' },
    promptGuidance: 'Write a listing offering a moving/relocation service. Emphasize vehicle/crew size, insurance, and service area if provided.' },
  { id: 'service-tutoring', category: 'service', label: { en: 'Private Tutoring Service', tr: 'Özel Ders Hizmeti' },
    promptGuidance: 'Write a listing offering private tutoring. Emphasize subject expertise, student level, and lesson format (online/in-person) if provided.' },
  { id: 'service-repair', category: 'service', label: { en: 'Repair / Maintenance Service', tr: 'Tadilat / Tamirat Hizmeti' },
    promptGuidance: 'Write a listing offering a repair/maintenance service. Emphasize specialty, response time, and service area if provided.' },
  { id: 'service-painting', category: 'service', label: { en: 'Painting & Renovation Service', tr: 'Boya & Badana Hizmeti' },
    promptGuidance: 'Write a listing offering a painting/renovation service. Emphasize scope of work, materials used, and estimated timeline if provided.' },
  { id: 'service-photography', category: 'service', label: { en: 'Photography Service', tr: 'Fotoğrafçılık Hizmeti' },
    promptGuidance: 'Write a listing offering a photography service. Emphasize specialty (wedding, portrait, product), package options, and delivery time if provided.' },
  { id: 'service-event', category: 'service', label: { en: 'Event / Wedding Organization', tr: 'Düğün / Organizasyon Hizmeti' },
    promptGuidance: 'Write a listing offering event/wedding organization services. Emphasize event types handled, capacity, and package inclusions if provided.' },

  // ---- SEO Meta ----
  { id: 'seo-blog', category: 'seo', label: { en: 'Blog Post SEO Title & Meta', tr: 'Blog Yazısı SEO Başlık & Açıklama' },
    promptGuidance: 'Write an SEO title and meta description for a blog post. The title must read as a compelling search-result headline; the description must summarize the article and include a soft call-to-action.',
    constraints: { maxTitleLen: 60, maxDescLen: 155 } },
  { id: 'seo-product-page', category: 'seo', label: { en: 'Product Page SEO Meta', tr: 'Ürün Sayfası SEO Meta' },
    promptGuidance: 'Write an SEO title and meta description for an e-commerce product page. Include the key selling point and, if relevant, price or availability framing.',
    constraints: { maxTitleLen: 60, maxDescLen: 155 } },
  { id: 'seo-category-page', category: 'seo', label: { en: 'Category Page SEO Meta', tr: 'Kategori Sayfası SEO Açıklaması' },
    promptGuidance: 'Write an SEO title and meta description for an e-commerce/content category page. Summarize what the visitor will find in the category.',
    constraints: { maxTitleLen: 60, maxDescLen: 155 } },
  { id: 'seo-gbp', category: 'seo', label: { en: 'Google Business Profile Description', tr: 'Google İşletme Profili Açıklaması' },
    promptGuidance: 'Write a short business name/title line and a Google Business Profile description. Emphasize what the business offers, location, and unique value. Avoid promotional superlatives Google disallows (e.g. "best", "#1") unless the user explicitly provided them as facts.',
    constraints: { maxTitleLen: 58, maxDescLen: 750 } },
  { id: 'seo-landing-page', category: 'seo', label: { en: 'Landing Page SEO Title & Meta', tr: 'Landing Page SEO Başlık & Açıklama' },
    promptGuidance: 'Write an SEO title and meta description for a marketing landing page. The title should include the core value proposition; the description should include a clear call-to-action.',
    constraints: { maxTitleLen: 60, maxDescLen: 155 } },

  // ---- Second-hand Item ----
  { id: 'secondhand-electronics', category: 'secondhand', label: { en: 'Second-hand Electronics', tr: 'İkinci El Elektronik' },
    promptGuidance: 'Write a second-hand marketplace listing for an electronics item. Be transparent about condition/usage signs, include what is included in the sale (box, charger, accessories), and state the price framing if provided.' },
  { id: 'secondhand-furniture', category: 'secondhand', label: { en: 'Second-hand Furniture', tr: 'İkinci El Mobilya' },
    promptGuidance: 'Write a second-hand marketplace listing for a furniture item. Be transparent about condition/wear, dimensions, and reason for selling only if explicitly given.' },
  { id: 'secondhand-clothing', category: 'secondhand', label: { en: 'Second-hand Clothing', tr: 'İkinci El Giyim' },
    promptGuidance: 'Write a second-hand marketplace listing for a clothing item. Be transparent about size, condition, and brand if provided.' }
];

function getCategories() {
  return CATEGORIES;
}

function getTypes() {
  return TYPES;
}

function getTypeById(id) {
  return TYPES.find(t => t.id === id) || null;
}

module.exports = { CATEGORIES, TYPES, getCategories, getTypes, getTypeById };
