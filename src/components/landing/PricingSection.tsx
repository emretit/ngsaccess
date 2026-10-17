import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { marketingFacts } from "./marketingFacts";

export default function PricingSection() {
  return <section id="pricing" className="bg-muted/30 px-4 py-20">
    <div className="mx-auto max-w-3xl space-y-5 text-center">
      <h2 className="text-3xl font-bold">Plan ve kullanım koşulları</h2>
      <p className="text-muted-foreground">{marketingFacts.planDescription}</p>
      <p className="text-muted-foreground">{marketingFacts.trialDescription}</p>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild><Link to="/register">{marketingFacts.accountCta}</Link></Button>
        <Button asChild variant="outline"><a href="mailto:info@ngsplus.app">Planlar hakkında bilgi al</a></Button>
      </div>
    </div>
  </section>;
}
