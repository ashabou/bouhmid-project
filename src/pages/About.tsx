import { Card, CardContent } from "@/components/ui/card";
import { Award, Users, Clock, Target } from "lucide-react";
import partsImage from "@/assets/parts-showcase.jpg";

const About = () => {
  const values = [
    {
      icon: Award,
      title: "Qualité",
      description: "Nous proposons uniquement des pièces de qualité certifiée pour garantir la fiabilité de vos véhicules.",
    },
    {
      icon: Users,
      title: "Expertise",
      description: "Notre équipe possède plus de 35 ans d'expérience dans le secteur automobile.",
    },
    {
      icon: Clock,
      title: "Disponibilité",
      description: "Service client réactif et stock permanent pour répondre rapidement à vos besoins.",
    },
    {
      icon: Target,
      title: "Fiabilité",
      description: "Des milliers de clients satisfaits nous font confiance depuis des décennies.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-hero py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">
            À Propos de Nous
          </h1>
          <p className="text-primary-foreground/90 text-lg">
            35 ans d'excellence au service de l'automobile tunisienne
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Story Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h2 className="text-3xl font-bold mb-6 text-foreground">
              Notre Histoire
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                Fondée en 1989, <span className="font-semibold text-foreground">Shabou Auto Pièces</span> est 
                devenue une référence incontournable dans la distribution de pièces détachées automobiles en Tunisie.
              </p>
              <p>
                Depuis plus de trois décennies, nous avons bâti notre réputation sur la qualité de nos produits,
                l'expertise de notre équipe et notre engagement envers la satisfaction client. Notre spécialisation
                dans les marques Renault, Peugeot, Citroën, Nissan et Isuzu nous permet d'offrir un service
                d'exception et des conseils pointus à nos clients.
              </p>
              <p>
                Aujourd'hui, nous sommes fiers de servir des milliers de particuliers, garagistes et professionnels
                de l'automobile à travers toute la Tunisie, en proposant une gamme complète de pièces détachées
                de qualité certifiée.
              </p>
            </div>
          </div>

          <div className="relative h-96 rounded-lg overflow-hidden shadow-card-hover">
            <img
              src={partsImage}
              alt="Shabou Auto Pièces"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="text-center shadow-card hover:shadow-card-hover transition-all">
            <CardContent className="p-6">
              <div className="text-4xl font-bold text-primary mb-2">35+</div>
              <p className="text-muted-foreground">Années d'expérience</p>
            </CardContent>
          </Card>
          <Card className="text-center shadow-card hover:shadow-card-hover transition-all">
            <CardContent className="p-6">
              <div className="text-4xl font-bold text-primary mb-2">5</div>
              <p className="text-muted-foreground">Marques spécialisées</p>
            </CardContent>
          </Card>
          <Card className="text-center shadow-card hover:shadow-card-hover transition-all">
            <CardContent className="p-6">
              <div className="text-4xl font-bold text-primary mb-2">1000+</div>
              <p className="text-muted-foreground">Pièces en stock</p>
            </CardContent>
          </Card>
          <Card className="text-center shadow-card hover:shadow-card-hover transition-all">
            <CardContent className="p-6">
              <div className="text-4xl font-bold text-primary mb-2">5000+</div>
              <p className="text-muted-foreground">Clients satisfaits</p>
            </CardContent>
          </Card>
        </div>

        {/* Values Section */}
        <div>
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            Nos Valeurs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <Card key={index} className="shadow-card hover:shadow-card-hover transition-all hover:-translate-y-1">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 bg-gradient-hero rounded-full flex items-center justify-center mx-auto mb-4">
                    <value.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3 text-foreground">{value.title}</h3>
                  <p className="text-muted-foreground text-sm">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Mission Section */}
        <div className="mt-16">
          <Card className="shadow-card bg-gradient-hero text-primary-foreground">
            <CardContent className="p-8">
              <h2 className="text-3xl font-bold mb-6 text-center">Notre Mission</h2>
              <p className="text-lg text-center text-primary-foreground/90 max-w-3xl mx-auto leading-relaxed">
                Fournir à nos clients des pièces détachées automobiles de qualité supérieure, accompagnées
                d'un service professionnel et de conseils d'experts, afin de garantir la sécurité, la performance
                et la longévité de leurs véhicules.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default About;
