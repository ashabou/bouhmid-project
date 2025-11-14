import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Truck, Clock, Phone } from "lucide-react";

const Livraison = () => {
  const zones = [
    { name: "Grand Tunis", delay: "24-48h", price: "7 TND" },
    { name: "Nord (Bizerte, Nabeul, Sousse)", delay: "2-3 jours", price: "10 TND" },
    { name: "Centre (Kairouan, Monastir, Mahdia)", delay: "2-3 jours", price: "12 TND" },
    { name: "Sud (Sfax, Gabès, Médenine)", delay: "3-4 jours", price: "15 TND" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-hero py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">
            Livraison en Tunisie
          </h1>
          <p className="text-primary-foreground/90 text-lg">
            Service de livraison rapide et fiable dans tout le pays
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                Zones de livraison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {zones.map((zone, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <div>
                      <h3 className="font-semibold text-foreground">{zone.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {zone.delay}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{zone.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Informations importantes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold text-foreground mb-2">📦 Conditions de livraison</h3>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>Livraison du lundi au samedi</li>
                  <li>Emballage sécurisé pour toutes les pièces</li>
                  <li>Suivi de commande en temps réel</li>
                  <li>Livraison gratuite pour commandes &gt; 500 TND</li>
                </ul>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold text-foreground mb-2">⏰ Délais de traitement</h3>
                <p className="text-sm text-muted-foreground">
                  Les commandes passées avant 14h sont traitées le jour même.
                  Les commandes passées après 14h sont traitées le lendemain.
                </p>
              </div>

              <div className="p-4 bg-accent/10 rounded-lg border border-accent/30">
                <h3 className="font-semibold text-foreground mb-2">💰 Modes de paiement</h3>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>Paiement à la livraison</li>
                  <li>Virement bancaire</li>
                  <li>Paiement en agence</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map Placeholder */}
        <Card className="shadow-card mb-12">
          <CardHeader>
            <CardTitle>Zones de couverture</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Carte de la Tunisie avec zones de livraison
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Nous livrons dans toute la Tunisie
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact CTA */}
        <Card className="shadow-card bg-gradient-hero text-primary-foreground">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Besoin d'informations sur votre livraison ?</h2>
            <p className="mb-6 text-primary-foreground/90">
              Notre équipe est à votre disposition pour répondre à toutes vos questions
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="tel:+21612345678">
                <Button variant="hero" size="lg">
                  <Phone className="w-5 h-5 mr-2" />
                  +216 12 345 678
                </Button>
              </a>
              <a href="https://wa.me/21612345678" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="lg" className="bg-card/10 text-primary-foreground border-primary-foreground/30 hover:bg-card/20">
                  Contacter sur WhatsApp
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Livraison;
