"""
Google Places API Scraper
Scrapes auto parts suppliers from Google Places API
"""
import googlemaps
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from ..models.lead import Lead, LeadStatus, LeadSource
from ..config import settings

logger = logging.getLogger(__name__)


class GooglePlacesScraper:
    """
    Scraper for Google Places API
    Finds auto parts suppliers and stores them as leads
    """

    def __init__(self, api_key: Optional[str] = None):
        """Initialize the Google Places scraper"""
        self.api_key = api_key or settings.GOOGLE_PLACES_API_KEY
        if not self.api_key:
            raise ValueError("Google Places API key is required")

        self.client = googlemaps.Client(key=self.api_key)
        self.logger = logger

    def search_places(
        self,
        query: str,
        location: str,
        radius: int = 50000,
        max_results: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Search for places using Google Places API

        Args:
            query: Search query (e.g., "auto parts supplier")
            location: Location string (e.g., "Tunis, Tunisia")
            radius: Search radius in meters (default: 50km)
            max_results: Maximum number of results to return

        Returns:
            List of place details
        """
        try:
            # Geocode the location to get lat/lng
            geocode_result = self.client.geocode(location)
            if not geocode_result:
                self.logger.error(f"Failed to geocode location: {location}")
                return []

            lat_lng = geocode_result[0]['geometry']['location']
            self.logger.info(f"Searching places near {location} ({lat_lng})")

            # Search for places
            places_result = self.client.places_nearby(
                location=lat_lng,
                radius=radius,
                keyword=query,
                type='car_repair'  # Auto-related business type
            )

            places = places_result.get('results', [])
            self.logger.info(f"Found {len(places)} places")

            # Get detailed information for each place
            detailed_places = []
            for place in places[:max_results]:
                place_id = place.get('place_id')
                if place_id:
                    details = self._get_place_details(place_id)
                    if details:
                        detailed_places.append(details)

            self.logger.info(f"Retrieved details for {len(detailed_places)} places")
            return detailed_places

        except Exception as e:
            self.logger.error(f"Error searching places: {str(e)}", exc_info=True)
            return []

    def _get_place_details(self, place_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information for a specific place

        Args:
            place_id: Google Place ID

        Returns:
            Place details dictionary or None
        """
        try:
            result = self.client.place(
                place_id=place_id,
                fields=[
                    'name', 'formatted_address', 'formatted_phone_number',
                    'website', 'rating', 'user_ratings_total', 'types',
                    'geometry', 'opening_hours', 'business_status'
                ]
            )

            return result.get('result', {})

        except Exception as e:
            self.logger.error(f"Error getting place details for {place_id}: {str(e)}")
            return None

    def create_lead_from_place(
        self,
        place: Dict[str, Any],
        db: Session
    ) -> Optional[Lead]:
        """
        Create a Lead from Google Place data

        Args:
            place: Place details from Google Places API
            db: Database session

        Returns:
            Created Lead or None
        """
        try:
            # Extract place information
            business_name = place.get('name', 'Unknown Business')
            address = place.get('formatted_address', '')
            phone = place.get('formatted_phone_number')
            website = place.get('website')

            # Extract city from address
            city = self._extract_city_from_address(address)

            # Check if lead already exists
            existing_lead = db.query(Lead).filter(
                Lead.business_name == business_name,
                Lead.source == LeadSource.GOOGLE_MAPS
            ).first()

            if existing_lead:
                self.logger.info(f"Lead already exists: {business_name}")
                return existing_lead

            # Calculate initial potential score
            potential_score = self._calculate_potential_score(place)

            # Create lead
            lead = Lead(
                source=LeadSource.GOOGLE_MAPS,
                source_url=f"https://maps.google.com/?cid={place.get('place_id', '')}",
                business_name=business_name,
                phone=phone,
                address=address,
                city=city,
                country="Tunisia",
                website_url=website,
                has_website=bool(website),
                potential_score=potential_score,
                status=LeadStatus.NEW,
                products_found={
                    'google_rating': place.get('rating'),
                    'total_reviews': place.get('user_ratings_total'),
                    'types': place.get('types', []),
                    'business_status': place.get('business_status'),
                },
                scraped_at=datetime.utcnow()
            )

            db.add(lead)
            db.commit()
            db.refresh(lead)

            self.logger.info(f"Created lead: {business_name} (score: {potential_score})")
            return lead

        except Exception as e:
            self.logger.error(f"Error creating lead from place: {str(e)}", exc_info=True)
            db.rollback()
            return None

    def scrape_and_store(
        self,
        query: str,
        location: str,
        db: Session,
        radius: int = 50000,
        max_results: int = 20
    ) -> Dict[str, Any]:
        """
        Search for places and store them as leads

        Args:
            query: Search query
            location: Location string
            db: Database session
            radius: Search radius in meters
            max_results: Maximum results to process

        Returns:
            Summary dictionary with results
        """
        self.logger.info(f"Starting Google Places scrape: query='{query}', location='{location}'")

        # Search for places
        places = self.search_places(query, location, radius, max_results)

        # Create leads
        created_leads = []
        existing_leads = []
        failed_leads = []

        for place in places:
            lead = self.create_lead_from_place(place, db)
            if lead:
                if lead.scraped_at.timestamp() > (datetime.utcnow().timestamp() - 60):
                    created_leads.append(lead)
                else:
                    existing_leads.append(lead)
            else:
                failed_leads.append(place.get('name', 'Unknown'))

        summary = {
            'total_found': len(places),
            'created': len(created_leads),
            'existing': len(existing_leads),
            'failed': len(failed_leads),
            'query': query,
            'location': location,
            'timestamp': datetime.utcnow().isoformat()
        }

        self.logger.info(
            f"Scrape complete: {summary['created']} created, "
            f"{summary['existing']} existing, {summary['failed']} failed"
        )

        return summary

    def _extract_city_from_address(self, address: str) -> Optional[str]:
        """
        Extract city from formatted address

        Args:
            address: Formatted address string

        Returns:
            City name or None
        """
        if not address:
            return None

        # Common Tunisian cities
        cities = [
            'Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte',
            'Gabès', 'Ariana', 'Gafsa', 'Monastir', 'Ben Arous',
            'Kasserine', 'Médenine', 'Nabeul', 'Tataouine', 'Béja',
            'Jendouba', 'Kef', 'Mahdia', 'Sidi Bouzid', 'Siliana',
            'Tozeur', 'Zaghouan', 'Manouba', 'Kebili'
        ]

        address_lower = address.lower()
        for city in cities:
            if city.lower() in address_lower:
                return city

        # Try to extract from address parts
        parts = address.split(',')
        if len(parts) >= 2:
            # Usually city is the second-to-last part
            return parts[-2].strip()

        return None

    def _calculate_potential_score(self, place: Dict[str, Any]) -> int:
        """
        Calculate potential lead score based on place data

        Args:
            place: Place details dictionary

        Returns:
            Score from 0-100
        """
        score = 50  # Base score

        # Has website (+20 points)
        if place.get('website'):
            score += 20

        # High rating (+15 points for 4+ stars)
        rating = place.get('rating', 0)
        if rating >= 4.0:
            score += 15
        elif rating >= 3.0:
            score += 5

        # Many reviews (+10 points for 50+ reviews)
        total_reviews = place.get('user_ratings_total', 0)
        if total_reviews >= 50:
            score += 10
        elif total_reviews >= 20:
            score += 5

        # Has phone number (+5 points)
        if place.get('formatted_phone_number'):
            score += 5

        # Business is operational (+5 points)
        if place.get('business_status') == 'OPERATIONAL':
            score += 5

        # Ensure score is within bounds
        return max(0, min(100, score))
