"""
Website Scraper
Scrapes supplier websites for product and pricing information
"""
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
from bs4 import BeautifulSoup
import httpx
import logging
import re
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from ..models.lead import Lead, LeadProduct
from ..config import settings

logger = logging.getLogger(__name__)


class WebsiteScraper:
    """
    Scraper for supplier websites
    Extracts product and pricing information
    """

    def __init__(self):
        """Initialize the website scraper"""
        self.logger = logger
        self.timeout = settings.SCRAPING_TIMEOUT * 1000  # Convert to milliseconds
        self.user_agent = settings.SCRAPING_USER_AGENT

    async def scrape_website(
        self,
        url: str,
        use_playwright: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Scrape a website and extract product information

        Args:
            url: Website URL to scrape
            use_playwright: Whether to use Playwright for JavaScript-heavy sites

        Returns:
            Dictionary with scraped data or None
        """
        try:
            if use_playwright:
                html = await self._fetch_with_playwright(url)
            else:
                html = await self._fetch_with_httpx(url)

            if not html:
                return None

            # Parse HTML
            soup = BeautifulSoup(html, 'lxml')

            # Extract data
            products = self._extract_products(soup)
            contact_info = self._extract_contact_info(soup)

            return {
                'url': url,
                'products': products,
                'contact_info': contact_info,
                'product_count': len(products)
            }

        except Exception as e:
            self.logger.error(f"Error scraping {url}: {str(e)}", exc_info=True)
            return None

    async def _fetch_with_httpx(self, url: str) -> Optional[str]:
        """
        Fetch website HTML using httpx (for static sites)

        Args:
            url: Website URL

        Returns:
            HTML content or None
        """
        try:
            async with httpx.AsyncClient(
                headers={'User-Agent': self.user_agent},
                timeout=settings.SCRAPING_TIMEOUT,
                follow_redirects=True
            ) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.text

        except Exception as e:
            self.logger.error(f"Error fetching with httpx: {str(e)}")
            return None

    async def _fetch_with_playwright(self, url: str) -> Optional[str]:
        """
        Fetch website HTML using Playwright (for JavaScript-heavy sites)

        Args:
            url: Website URL

        Returns:
            HTML content or None
        """
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent=self.user_agent
                )
                page = await context.new_page()

                try:
                    await page.goto(url, timeout=self.timeout, wait_until='networkidle')
                    html = await page.content()
                    await browser.close()
                    return html

                except PlaywrightTimeout:
                    self.logger.warning(f"Timeout loading {url}")
                    await browser.close()
                    return None

        except Exception as e:
            self.logger.error(f"Error fetching with Playwright: {str(e)}")
            return None

    def _extract_products(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """
        Extract product information from HTML

        Args:
            soup: BeautifulSoup object

        Returns:
            List of product dictionaries
        """
        products = []

        # Common product container selectors
        product_selectors = [
            'div.product',
            'div.product-item',
            'div.product-card',
            'article.product',
            'li.product',
            'div[data-product-id]',
            'div.auto-part',
            'div.part-item'
        ]

        # Try each selector
        for selector in product_selectors:
            product_elements = soup.select(selector)
            if product_elements:
                self.logger.debug(f"Found {len(product_elements)} products with selector '{selector}'")

                for element in product_elements[:50]:  # Limit to 50 products
                    product = self._parse_product_element(element)
                    if product:
                        products.append(product)

                if products:
                    break

        # If no structured products found, try to find prices in the page
        if not products:
            products = self._extract_prices_from_text(soup)

        return products

    def _parse_product_element(self, element) -> Optional[Dict[str, Any]]:
        """
        Parse a single product element

        Args:
            element: BeautifulSoup element

        Returns:
            Product dictionary or None
        """
        try:
            # Extract product name
            name_selectors = [
                'h3', 'h4', '.product-name', '.product-title',
                '[data-product-name]', '.title', '.name'
            ]

            name = None
            for selector in name_selectors:
                name_elem = element.select_one(selector)
                if name_elem:
                    name = name_elem.get_text(strip=True)
                    break

            if not name:
                return None

            # Extract price
            price_selectors = [
                '.price', '.product-price', '[data-price]',
                '.price-tag', '.amount', '.cost'
            ]

            price = None
            price_text = None
            for selector in price_selectors:
                price_elem = element.select_one(selector)
                if price_elem:
                    price_text = price_elem.get_text(strip=True)
                    price = self._extract_price_from_text(price_text)
                    if price:
                        break

            # Extract part number
            part_number = None
            part_selectors = [
                '[data-part-number]', '.part-number', '.sku',
                '.ref', '.reference', '.code'
            ]

            for selector in part_selectors:
                part_elem = element.select_one(selector)
                if part_elem:
                    part_number = part_elem.get_text(strip=True)
                    break

            # Extract brand
            brand = None
            brand_selectors = [
                '.brand', '.manufacturer', '[data-brand]',
                '.brand-name', '.make'
            ]

            for selector in brand_selectors:
                brand_elem = element.select_one(selector)
                if brand_elem:
                    brand = brand_elem.get_text(strip=True)
                    break

            return {
                'name': name,
                'price': price,
                'price_text': price_text,
                'part_number': part_number,
                'brand': brand
            }

        except Exception as e:
            self.logger.debug(f"Error parsing product element: {str(e)}")
            return None

    def _extract_prices_from_text(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """
        Extract prices from page text when no structured products found

        Args:
            soup: BeautifulSoup object

        Returns:
            List of product dictionaries
        """
        products = []

        # Find all text that might contain prices
        price_pattern = r'(\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})?)\s*(?:TND|DT|DIN|د\.ت)'

        text_elements = soup.find_all(['p', 'div', 'span', 'td'])

        for element in text_elements:
            text = element.get_text()
            matches = re.findall(price_pattern, text)

            if matches:
                for match in matches:
                    price = self._extract_price_from_text(match)
                    if price:
                        products.append({
                            'name': text[:100].strip(),  # Use surrounding text as name
                            'price': price,
                            'price_text': match,
                            'part_number': None,
                            'brand': None
                        })

        return products[:20]  # Limit to 20 prices

    def _extract_price_from_text(self, text: str) -> Optional[float]:
        """
        Extract numeric price from text

        Args:
            text: Text containing price

        Returns:
            Price as float or None
        """
        if not text:
            return None

        # Remove currency symbols and common price text
        cleaned = re.sub(r'[TND|DT|DIN|د\.ت|€|$|,\s]', '', text)

        # Extract first number
        match = re.search(r'(\d+(?:\.\d{2})?)', cleaned)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                return None

        return None

    def _extract_contact_info(self, soup: BeautifulSoup) -> Dict[str, Optional[str]]:
        """
        Extract contact information from page

        Args:
            soup: BeautifulSoup object

        Returns:
            Dictionary with contact information
        """
        contact_info = {
            'email': None,
            'phone': None,
            'address': None
        }

        # Extract email
        email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        emails = re.findall(email_pattern, soup.get_text())
        if emails:
            contact_info['email'] = emails[0]

        # Extract phone (Tunisian format)
        phone_pattern = r'(?:\+216|00216|216)?\s*\d{2}\s*\d{3}\s*\d{3}'
        phones = re.findall(phone_pattern, soup.get_text())
        if phones:
            contact_info['phone'] = phones[0].strip()

        # Extract address (simple heuristic)
        address_keywords = ['adresse', 'address', 'rue', 'avenue', 'boulevard']
        for element in soup.find_all(['p', 'div', 'span']):
            text = element.get_text(strip=True).lower()
            if any(keyword in text for keyword in address_keywords):
                contact_info['address'] = element.get_text(strip=True)[:200]
                break

        return contact_info

    async def scrape_and_store_products(
        self,
        lead: Lead,
        db: Session,
        use_playwright: bool = False
    ) -> Dict[str, Any]:
        """
        Scrape products from lead's website and store them

        Args:
            lead: Lead object with website_url
            db: Database session
            use_playwright: Whether to use Playwright

        Returns:
            Summary dictionary
        """
        if not lead.website_url:
            return {
                'success': False,
                'message': 'Lead has no website URL',
                'products_found': 0
            }

        self.logger.info(f"Scraping website for lead {lead.id}: {lead.website_url}")

        # Scrape website
        data = await self.scrape_website(lead.website_url, use_playwright)

        if not data:
            return {
                'success': False,
                'message': 'Failed to scrape website',
                'products_found': 0
            }

        # Store products
        products_created = 0
        for product_data in data['products']:
            try:
                # Check if product already exists
                existing = db.query(LeadProduct).filter(
                    LeadProduct.lead_id == lead.id,
                    LeadProduct.name == product_data['name']
                ).first()

                if existing:
                    continue

                # Create lead product
                lead_product = LeadProduct(
                    lead_id=lead.id,
                    name=product_data['name'],
                    price=product_data.get('price'),
                    currency='TND',
                    part_number=product_data.get('part_number'),
                    brand=product_data.get('brand')
                )

                db.add(lead_product)
                products_created += 1

            except Exception as e:
                self.logger.error(f"Error creating lead product: {str(e)}")
                continue

        # Update lead with contact info if found
        if data['contact_info']['email'] and not lead.email:
            lead.email = data['contact_info']['email']
        if data['contact_info']['phone'] and not lead.phone:
            lead.phone = data['contact_info']['phone']

        db.commit()

        self.logger.info(
            f"Scraped {products_created} products for lead {lead.id}"
        )

        return {
            'success': True,
            'message': f'Scraped {products_created} products',
            'products_found': products_created,
            'total_products_on_page': len(data['products'])
        }
