import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, Brain, BarChart3, Settings } from "lucide-react";

const Admin = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-hero py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">
            Interface Privée - Admin
          </h1>
          <p className="text-primary-foreground/90 text-lg">
            Outils d'intelligence d'affaires et automatisation
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Quick Stats */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Commandes en attente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">12</div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Stock faible</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">8</div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Nouvelles demandes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">5</div>
            </CardContent>
          </Card>
        </div>

        {/* AI Tools Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card className="shadow-card border-2 border-accent/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <Search className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <CardTitle>Scan du Marché</CardTitle>
                  <CardDescription>
                    Détection automatique des pièces à bas prix chez les concurrents
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Agent IA qui parcourt les sites concurrents pour identifier les opportunités
                  d'achat de pièces à prix réduit pour revente.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Statut:</span>
                    <Badge variant="outline">Prêt à configurer</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Dernière exécution:</span>
                    <span>-</span>
                  </div>
                </div>
                <Button variant="industrial" className="w-full">
                  <Settings className="w-4 h-4 mr-2" />
                  Configurer le scan
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-2 border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Prévisions de Demande</CardTitle>
                  <CardDescription>
                    Analyse prédictive des tendances et besoins futurs
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Agent IA qui analyse les données historiques pour prédire les pièces
                  qui seront les plus demandées dans les prochaines semaines.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Statut:</span>
                    <Badge variant="outline">En développement</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Précision estimée:</span>
                    <span>-</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full" disabled>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Voir les prévisions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Table Placeholder */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Résultats du scan marché</CardTitle>
                <CardDescription>
                  Opportunités détectées automatiquement
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <BarChart3 className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pièce</TableHead>
                  <TableHead>Concurrent</TableHead>
                  <TableHead>Prix concurrent</TableHead>
                  <TableHead>Notre prix</TableHead>
                  <TableHead>Économie</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Aucune donnée disponible. Configurez le scan pour commencer.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Info Banner */}
        <Card className="shadow-card bg-muted mt-8">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  Interface prête pour l'intégration IA
                </h3>
                <p className="text-sm text-muted-foreground">
                  Cette interface est conçue pour accueillir des agents IA automatisés qui analyseront
                  le marché, identifieront les opportunités et fourniront des prévisions de demande.
                  Les composants sont prêts à être connectés à votre backend API.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
