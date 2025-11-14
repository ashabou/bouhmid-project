import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Truck, Phone, Clock, Wrench } from "lucide-react";
import heroImage from "@/assets/hero-automotive.jpg";
import partsImage from "@/assets/parts-showcase.jpg";

const Home = () => {
  const brands = [
    { name: "Renault", logo: "🚗" },
    { name: "Peugeot", logo: "🦁" },
    { name: "Citroën", logo: "⚡" },
    { name: "Nissan", logo: "🔴" },
    { name: "Isuzu", logo: "🔷" },
  ];

  const features = [
    {
      icon: Wrench,
      title: "35 ans d'expertise",
      description: "Leader tunisien en pièces détachées automobiles",
    },
    {
      icon: Check,
      title: "Large disponibilité",
      description: "Stock permanent pour toutes les marques",
    },
    {
      icon: Truck,
      title: "Livraison en Tunisie",
      description: "Service de livraison rapide dans tout le pays",
    },
    {
      icon: Clock,
      title: "Service client réactif",
      description: "Assistance et conseil personnalisé",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/85 to-primary/75" />
        </div>
        
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground mb-6 animate-fade-in">
            35 ans d'expertise en<br />pièces automobiles
          </h1>
          <p className="text-xl md:text-2xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Spécialiste des pièces détachées pour Renault, Peugeot, Citroën, Nissan et Isuzu
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/catalogue">
              <Button variant="hero" size="xl">
                Voir le catalogue
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="xl" className="bg-card/10 text-primary-foreground border-primary-foreground/30 hover:bg-card/20">
                Nous contacter
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Brands Section */}
      <section className="py-16 bg-muted">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            Nos Marques
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {brands.map((brand) => (
              <Card key={brand.name} className="hover:shadow-card-hover transition-all duration-300">
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <div className="text-5xl mb-3">{brand.logo}</div>
                  <h3 className="text-lg font-semibold text-foreground">{brand.name}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            Pourquoi nous choisir ?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="text-center hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="w-14 h-14 bg-gradient-hero rounded-full flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* About Preview Section */}
      <section className="py-16 bg-muted">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6 text-foreground">
                Une histoire de passion automobile
              </h2>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                Depuis 1989, Shabou Auto Pièces s'est imposé comme un acteur majeur dans la distribution
                de pièces détachées automobiles en Tunisie. Notre expertise couvre l'ensemble des besoins
                pour les marques Renault, Peugeot, Citroën, Nissan et Isuzu.
              </p>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Avec plus de trois décennies d'expérience, nous garantissons à nos clients des pièces
                de qualité, un service professionnel et des conseils d'experts pour tous leurs besoins
                en maintenance et réparation automobile.
              </p>
              <Link to="/a-propos">
                <Button variant="industrial">
                  En savoir plus
                </Button>
              </Link>
            </div>
            <div className="relative h-96 rounded-lg overflow-hidden shadow-card-hover">
              <img
                src={partsImage}
                alt="Pièces automobiles"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-primary-foreground mb-6">
            Besoin d'une pièce spécifique ?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Notre équipe d'experts est à votre disposition pour vous conseiller
            et trouver la pièce qu'il vous faut.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="tel:+21612345678">
              <Button variant="hero" size="lg">
                <Phone className="w-5 h-5 mr-2" />
                +216 12 345 678
              </Button>
            </a>
            <Link to="/contact">
              <Button variant="outline" size="lg" className="bg-card/10 text-primary-foreground border-primary-foreground/30 hover:bg-card/20">
                Formulaire de contact
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
