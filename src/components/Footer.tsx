import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Facebook, Instagram } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-xl font-bold mb-4">Shabou Auto Pièces</h3>
            <p className="text-primary-foreground/80 mb-4">
              Leader tunisien en pièces détachées automobiles depuis 1989.
              Spécialiste Renault, Peugeot, Citroën, Nissan et Isuzu.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-primary-foreground/80 hover:text-accent transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="text-primary-foreground/80 hover:text-accent transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Liens Rapides</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/catalogue" className="text-primary-foreground/80 hover:text-accent transition-colors">
                  Catalogue
                </Link>
              </li>
              <li>
                <Link to="/livraison" className="text-primary-foreground/80 hover:text-accent transition-colors">
                  Livraison
                </Link>
              </li>
              <li>
                <Link to="/a-propos" className="text-primary-foreground/80 hover:text-accent transition-colors">
                  À propos
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-primary-foreground/80 hover:text-accent transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Brands */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Marques</h3>
            <ul className="space-y-2 text-primary-foreground/80">
              <li>Renault</li>
              <li>Peugeot</li>
              <li>Citroën</li>
              <li>Nissan</li>
              <li>Isuzu</li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <MapPin className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-primary-foreground/80">
                  Avenue Habib Bourguiba, Tunis, Tunisie
                </span>
              </li>
              <li className="flex items-center">
                <Phone className="w-5 h-5 mr-2 flex-shrink-0" />
                <a href="tel:+21612345678" className="text-primary-foreground/80 hover:text-accent transition-colors">
                  +216 12 345 678
                </a>
              </li>
              <li className="flex items-center">
                <Mail className="w-5 h-5 mr-2 flex-shrink-0" />
                <a href="mailto:contact@shabouauto.tn" className="text-primary-foreground/80 hover:text-accent transition-colors">
                  contact@shabouauto.tn
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 mt-8 pt-8 text-center text-primary-foreground/60">
          <p>&copy; {new Date().getFullYear()} Shabou Auto Pièces. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
