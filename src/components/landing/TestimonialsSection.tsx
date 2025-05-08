
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface TestimonialProps {
  quote: string;
  name: string;
  title: string;
}

const TestimonialCard = ({ quote, name, title }: TestimonialProps) => {
  return (
    <Card className="border-none shadow-md hover:shadow-lg transition-all">
      <CardContent className="pt-6">
        <div className="flex flex-col h-full">
          <div className="mb-6">
            <p className="italic text-muted-foreground">{quote}</p>
          </div>
          <div className="mt-auto flex items-center">
            <div className="h-10 w-10 rounded-full bg-gray-200"></div>
            <div className="ml-3">
              <p className="font-medium">{name}</p>
              <p className="text-sm text-muted-foreground">{title}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const TestimonialsSection = () => {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold">Müşterilerimiz Ne Diyor?</h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            Türkiye genelinde her boyuttaki işletmeler tarafından tercih ediliyoruz
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <TestimonialCard
            quote="Bu sistem, personel devamını yönetme şeklimizi tamamen değiştirdi. Raporlar inanılmaz ve QR kod sistemi kullanımı çok kolay."
            name="Ahmet Yılmaz"
            title="İK Direktörü, Tekno A.Ş."
          />
          
          <TestimonialCard
            quote="Yapay zeka destekli raporlar bize daha önce hiç sahip olmadığımız içgörüler sağladı. Uygulama süreci sorunsuzdu ve destek ekibi çok hızlı yanıt veriyor."
            name="Elif Kaya"
            title="Operasyon Müdürü, Global Lojistik"
          />
          
          <TestimonialCard
            quote="Güvenlik bizim ana endişemizdi ve bu sistem beklentilerimizi aştı. Bulut depolama güvenli ve geçiş kontrol özellikleri çok sağlam."
            name="Mehmet Can"
            title="CTO, Güvenlik Çözümleri"
          />
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
