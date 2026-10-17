import { marketingFacts } from "@/components/landing/marketingFacts";

import { Card, CardContent } from "@/components/ui/card";

const stats = marketingFacts.capabilities;

const DemoStats = () => {
  return (
    <div className="py-16 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-2xl font-bold text-foreground mb-4">
            PDKS ile neler yapabilirsiniz?
          </h2>
          <p className="text-lg text-muted-foreground">
            İşyerinizin personel ve geçiş kayıtlarını tek yerde yönetin.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <Card key={index} className="border-0 shadow-lg text-center">
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-primary mb-2">
                  {stat.value}
                </div>
                <div className="text-xl font-semibold text-foreground mb-1">
                  {stat.label}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.description}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DemoStats;
