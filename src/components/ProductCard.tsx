import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, ShoppingCart } from "lucide-react";
import { Product } from "@/data/products";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const handleWhatsApp = () => {
    const message = `Bonjour, je suis intéressé par ${product.name} (Réf: ${product.reference})`;
    const phoneNumber = "21612345678";
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <Card className="group h-full flex flex-col transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1">
      <CardContent className="p-4 flex-1">
        <div className="relative mb-4 overflow-hidden rounded-md bg-muted aspect-square">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          {product.popular && (
            <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground">
              Populaire
            </Badge>
          )}
          {!product.inStock && (
            <Badge variant="destructive" className="absolute top-2 left-2">
              Rupture
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Réf: <span className="font-mono">{product.reference}</span>
          </p>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {product.brand}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {product.category}
            </Badge>
          </div>

          <div className="text-xs text-muted-foreground">
            Compatible: {product.compatibleCars.slice(0, 2).join(", ")}
            {product.compatibleCars.length > 2 && "..."}
          </div>

          <div className="text-2xl font-bold text-primary">
            {product.price.toFixed(2)} <span className="text-sm">TND</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex flex-col gap-2">
        <Button 
          variant="industrial" 
          className="w-full"
          disabled={!product.inStock}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          {product.inStock ? "Commander" : "Non disponible"}
        </Button>
        <Button 
          variant="outline" 
          className="w-full"
          onClick={handleWhatsApp}
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          WhatsApp
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProductCard;
