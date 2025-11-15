"""
Lead Scoring Algorithm
Calculates potential score for leads based on multiple factors
"""
import logging
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from ..models.lead import Lead, LeadProduct

logger = logging.getLogger(__name__)


class LeadScorer:
    """
    Advanced lead scoring system
    Calculates potential score (0-100) based on multiple factors
    """

    def __init__(self):
        """Initialize the lead scorer"""
        self.logger = logger

    def calculate_score(
        self,
        lead: Lead,
        db: Session,
        product_count: Optional[int] = None
    ) -> int:
        """
        Calculate comprehensive lead score

        Args:
            lead: Lead object
            db: Database session
            product_count: Optional pre-calculated product count

        Returns:
            Score from 0-100
        """
        score = 0

        # Base score components
        score += self._score_website_presence(lead)          # Max 20 points
        score += self._score_contact_information(lead)       # Max 15 points
        score += self._score_google_data(lead)               # Max 20 points
        score += self._score_product_catalog(lead, db, product_count)  # Max 25 points
        score += self._score_location(lead)                  # Max 10 points
        score += self._score_competitiveness(lead, db)       # Max 10 points

        # Ensure score is within bounds
        return max(0, min(100, score))

    def _score_website_presence(self, lead: Lead) -> int:
        """
        Score based on website presence and quality

        Returns:
            0-20 points
        """
        score = 0

        if lead.has_website and lead.website_url:
            score += 10  # Has website

            # Check if it's a professional domain
            if any(domain in lead.website_url.lower() for domain in ['.com', '.tn', '.org']):
                score += 5  # Professional domain

            # Check if HTTPS
            if lead.website_url.startswith('https://'):
                score += 3  # Secure website

            # Check if not just social media
            social_media = ['facebook.com', 'instagram.com', 'twitter.com']
            if not any(sm in lead.website_url.lower() for sm in social_media):
                score += 2  # Independent website

        return score

    def _score_contact_information(self, lead: Lead) -> int:
        """
        Score based on available contact information

        Returns:
            0-15 points
        """
        score = 0

        if lead.phone:
            score += 5  # Has phone
        if lead.email:
            score += 5  # Has email
        if lead.address:
            score += 3  # Has address
        if lead.contact_name:
            score += 2  # Has contact person

        return score

    def _score_google_data(self, lead: Lead) -> int:
        """
        Score based on Google Places data

        Returns:
            0-20 points
        """
        score = 0

        if lead.products_found and isinstance(lead.products_found, dict):
            google_data = lead.products_found

            # Rating score (max 10 points)
            rating = google_data.get('google_rating')
            if rating:
                if rating >= 4.5:
                    score += 10
                elif rating >= 4.0:
                    score += 8
                elif rating >= 3.5:
                    score += 5
                elif rating >= 3.0:
                    score += 2

            # Reviews score (max 7 points)
            total_reviews = google_data.get('total_reviews', 0)
            if total_reviews >= 100:
                score += 7
            elif total_reviews >= 50:
                score += 5
            elif total_reviews >= 20:
                score += 3
            elif total_reviews >= 10:
                score += 1

            # Business status (max 3 points)
            if google_data.get('business_status') == 'OPERATIONAL':
                score += 3

        return score

    def _score_product_catalog(
        self,
        lead: Lead,
        db: Session,
        product_count: Optional[int] = None
    ) -> int:
        """
        Score based on product catalog size and quality

        Returns:
            0-25 points
        """
        score = 0

        # Get product count
        if product_count is None:
            product_count = db.query(LeadProduct).filter(
                LeadProduct.lead_id == lead.id
            ).count()

        # Catalog size score (max 15 points)
        if product_count >= 100:
            score += 15
        elif product_count >= 50:
            score += 12
        elif product_count >= 20:
            score += 8
        elif product_count >= 10:
            score += 5
        elif product_count >= 1:
            score += 2

        # Product data quality score (max 10 points)
        if product_count > 0:
            products = db.query(LeadProduct).filter(
                LeadProduct.lead_id == lead.id
            ).limit(10).all()

            # Check data completeness
            has_prices = sum(1 for p in products if p.price is not None)
            has_part_numbers = sum(1 for p in products if p.part_number)
            has_brands = sum(1 for p in products if p.brand)

            if has_prices >= len(products) * 0.8:  # 80%+ have prices
                score += 4
            if has_part_numbers >= len(products) * 0.5:  # 50%+ have part numbers
                score += 3
            if has_brands >= len(products) * 0.5:  # 50%+ have brands
                score += 3

        return score

    def _score_location(self, lead: Lead) -> int:
        """
        Score based on location (prioritize major cities)

        Returns:
            0-10 points
        """
        score = 0

        if not lead.city:
            return 0

        city_lower = lead.city.lower()

        # Major cities (higher score)
        major_cities = ['tunis', 'sfax', 'sousse', 'bizerte']
        if any(city in city_lower for city in major_cities):
            score += 10

        # Medium cities
        medium_cities = ['ariana', 'ben arous', 'monastir', 'nabeul']
        elif any(city in city_lower for city in medium_cities):
            score += 7

        # Other cities
        else:
            score += 4

        return score

    def _score_competitiveness(self, lead: Lead, db: Session) -> int:
        """
        Score based on price competitiveness

        Returns:
            0-10 points
        """
        score = 0

        # Use price_competitiveness_score if available
        if lead.price_competitiveness_score:
            # Score is between 0 and 1, convert to 0-10
            score = int(lead.price_competitiveness_score * 10)

        return score

    def update_lead_score(self, lead: Lead, db: Session) -> int:
        """
        Update a lead's potential score

        Args:
            lead: Lead object
            db: Database session

        Returns:
            Updated score
        """
        try:
            new_score = self.calculate_score(lead, db)
            lead.potential_score = new_score
            db.commit()
            db.refresh(lead)

            self.logger.info(f"Updated score for lead {lead.id}: {new_score}")
            return new_score

        except Exception as e:
            self.logger.error(f"Error updating lead score: {str(e)}", exc_info=True)
            db.rollback()
            return lead.potential_score or 0

    def batch_update_scores(self, db: Session, limit: Optional[int] = None) -> Dict[str, Any]:
        """
        Update scores for multiple leads

        Args:
            db: Database session
            limit: Optional limit on number of leads to update

        Returns:
            Summary dictionary
        """
        try:
            query = db.query(Lead)
            if limit:
                query = query.limit(limit)

            leads = query.all()

            updated_count = 0
            scores = []

            for lead in leads:
                old_score = lead.potential_score or 0
                new_score = self.calculate_score(lead, db)

                if new_score != old_score:
                    lead.potential_score = new_score
                    updated_count += 1

                scores.append(new_score)

            db.commit()

            return {
                'total_leads': len(leads),
                'updated_count': updated_count,
                'average_score': sum(scores) / len(scores) if scores else 0,
                'max_score': max(scores) if scores else 0,
                'min_score': min(scores) if scores else 0
            }

        except Exception as e:
            self.logger.error(f"Error in batch score update: {str(e)}", exc_info=True)
            db.rollback()
            return {
                'total_leads': 0,
                'updated_count': 0,
                'error': str(e)
            }
