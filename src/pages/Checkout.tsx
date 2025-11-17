import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/hooks/use-cart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ShoppingCart, Package, CreditCard, Truck, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

const Checkout = () => {
  const { items, getTotalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    deliveryAddress: '',
    deliveryCity: '',
    deliveryRegion: '',
    postalCode: '',
    deliveryNotes: '',
    paymentMethod: 'CASH_ON_DELIVERY' as const,
  });

  const totalPrice = getTotalPrice();
  const shippingCost = totalPrice > 200 ? 0 : 7;
  const finalTotal = totalPrice + shippingCost;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePaymentMethodChange = (value: string) => {
    setFormData((prev) => ({ ...prev, paymentMethod: value as any }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Build order payload
      const orderPayload = {
        ...formData,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      };

      // Call real backend API
      const response = await api.createOrder(orderPayload);

      if (response.success) {
        toast({
          title: 'Commande confirmée !',
          description: `Votre commande N° ${response.data?.orderNumber} a été envoyée avec succès. Nous vous contacterons bientôt.`,
        });

        clearCart();

        // Redirect to home after success
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        throw new Error(response.message || 'Failed to create order');
      }
    } catch (error: any) {
      console.error('Order creation error:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Une erreur est survenue. Veuillez réessayer.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-4">Votre panier est vide</h1>
          <p className="text-muted-foreground mb-8">
            Ajoutez des produits à votre panier pour passer commande
          </p>
          <Button asChild>
            <a href="/catalogue">Parcourir le catalogue</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Passer commande</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Order Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Informations personnelles
                  </CardTitle>
                  <CardDescription>
                    Vos coordonnées pour la livraison et le contact
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="customerName">Nom complet *</Label>
                    <Input
                      id="customerName"
                      name="customerName"
                      required
                      value={formData.customerName}
                      onChange={handleInputChange}
                      placeholder="Mohamed Ben Ahmed"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="customerPhone">Téléphone *</Label>
                      <Input
                        id="customerPhone"
                        name="customerPhone"
                        type="tel"
                        required
                        value={formData.customerPhone}
                        onChange={handleInputChange}
                        placeholder="+216 12 345 678"
                      />
                    </div>

                    <div>
                      <Label htmlFor="customerEmail">Email (optionnel)</Label>
                      <Input
                        id="customerEmail"
                        name="customerEmail"
                        type="email"
                        value={formData.customerEmail}
                        onChange={handleInputChange}
                        placeholder="votre@email.com"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Address */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Adresse de livraison
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="deliveryAddress">Adresse complète *</Label>
                    <Textarea
                      id="deliveryAddress"
                      name="deliveryAddress"
                      required
                      value={formData.deliveryAddress}
                      onChange={handleInputChange}
                      placeholder="Rue, numéro, immeuble, etc."
                      rows={3}
                    />
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="deliveryCity">Ville *</Label>
                      <Input
                        id="deliveryCity"
                        name="deliveryCity"
                        required
                        value={formData.deliveryCity}
                        onChange={handleInputChange}
                        placeholder="Tunis"
                      />
                    </div>

                    <div>
                      <Label htmlFor="deliveryRegion">Gouvernorat</Label>
                      <Input
                        id="deliveryRegion"
                        name="deliveryRegion"
                        value={formData.deliveryRegion}
                        onChange={handleInputChange}
                        placeholder="Tunis"
                      />
                    </div>

                    <div>
                      <Label htmlFor="postalCode">Code postal</Label>
                      <Input
                        id="postalCode"
                        name="postalCode"
                        value={formData.postalCode}
                        onChange={handleInputChange}
                        placeholder="1000"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="deliveryNotes">
                      Instructions de livraison (optionnel)
                    </Label>
                    <Textarea
                      id="deliveryNotes"
                      name="deliveryNotes"
                      value={formData.deliveryNotes}
                      onChange={handleInputChange}
                      placeholder="Indications supplémentaires pour le livreur..."
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Payment Method */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Mode de paiement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={formData.paymentMethod}
                    onValueChange={handlePaymentMethodChange}
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                      <RadioGroupItem value="CASH_ON_DELIVERY" id="cod" />
                      <Label htmlFor="cod" className="flex-1 cursor-pointer">
                        <div className="font-medium">Paiement à la livraison</div>
                        <div className="text-sm text-muted-foreground">
                          Payez en espèces lors de la réception
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                      <RadioGroupItem value="BANK_TRANSFER" id="transfer" />
                      <Label htmlFor="transfer" className="flex-1 cursor-pointer">
                        <div className="font-medium">Virement bancaire</div>
                        <div className="text-sm text-muted-foreground">
                          Effectuez un virement avant la livraison
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>En cours...</>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-5 w-5" />
                    Confirmer la commande
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Récapitulatif</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.productId} className="flex justify-between text-sm">
                      <span className="flex-1">
                        {item.name}
                        <span className="text-muted-foreground"> × {item.quantity}</span>
                      </span>
                      <span className="font-medium">
                        {(item.price * item.quantity).toFixed(2)} TND
                      </span>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sous-total</span>
                    <span>{totalPrice.toFixed(2)} TND</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Livraison</span>
                    <span>
                      {shippingCost === 0 ? (
                        <span className="text-green-600 font-medium">Gratuite</span>
                      ) : (
                        `${shippingCost.toFixed(2)} TND`
                      )}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{finalTotal.toFixed(2)} TND</span>
                </div>

                {totalPrice < 200 && (
                  <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
                    Ajoutez {(200 - totalPrice).toFixed(2)} TND pour bénéficier de la
                    livraison gratuite
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
