# Prospector Models

SQLAlchemy models for the Prospector agent database.

## Models

### Lead
Stores information about potential supplier leads.

**Fields:**
- `id` (UUID): Primary key
- `source` (LeadSource enum): Where the lead was found
- `business_name` (str): Name of the business
- `contact_name` (str, optional): Contact person name
- `phone` (str, optional): Phone number
- `email` (str, optional): Email address
- `city` (str, optional): City location
- `website_url` (str, optional): Business website
- `has_website` (bool): Whether business has a website
- `potential_score` (int, 0-100): Calculated lead score
- `status` (LeadStatus enum): Current status (NEW, CONTACTED, QUALIFIED, CONVERTED, REJECTED)
- `products_found` (JSON): Products found during scraping
- Timestamps: `scraped_at`, `contacted_at`, `qualified_at`, `created_at`, `last_updated_at`

### LeadProduct
Stores products found during lead scraping.

**Fields:**
- `id` (UUID): Primary key
- `lead_id` (UUID): Foreign key to Lead
- `name` (str): Product name
- `price` (float, optional): Product price
- `currency` (str): Price currency (default: TND)
- `part_number` (str, optional): Part number
- `brand` (str, optional): Brand name
- `matched_product_id` (UUID, optional): Matching product in main catalog
- `price_difference` (float, optional): Price difference vs catalog
- `scraped_at` (datetime): When the product was scraped

## Enums

### LeadStatus
- `NEW`: Newly discovered lead
- `CONTACTED`: Lead has been contacted
- `QUALIFIED`: Lead qualifies as potential supplier
- `CONVERTED`: Lead became a supplier
- `REJECTED`: Lead was rejected

### LeadSource
- `GOOGLE_MAPS`: Found via Google Maps/Places API
- `SUPPLIER_WEBSITE`: Found via website scraping
- `MARKETPLACE`: Found on marketplace platforms
- `MANUAL`: Manually entered

## Database Migrations

Use Alembic for database migrations:

```bash
# Create a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

## Usage Example

```python
from app.models import Lead, LeadProduct, LeadStatus, LeadSource, get_db

# Create a new lead
db = next(get_db())
lead = Lead(
    source=LeadSource.GOOGLE_MAPS,
    business_name="Auto Parts Tunisia",
    city="Tunis",
    has_website=True,
    website_url="https://example.com",
    potential_score=85,
    status=LeadStatus.NEW
)
db.add(lead)
db.commit()
db.refresh(lead)

# Query leads
high_potential_leads = db.query(Lead).filter(
    Lead.potential_score >= 70,
    Lead.status == LeadStatus.NEW
).all()
```
