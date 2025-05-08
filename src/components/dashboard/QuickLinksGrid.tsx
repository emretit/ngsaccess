
import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';

const QuickLinksGrid: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Link to="/employees" className="group">
        <Card className="transition-all duration-300 group-hover:border-primary group-hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center text-muted-foreground group-hover:text-primary">
              <Users className="h-5 w-5 mr-2" /> Personel Yönetimi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Personel bilgilerini görüntüle, düzenle ve yeni personel ekle.
            </p>
          </CardContent>
        </Card>
      </Link>
      
      <Link to="/pdks-records" className="group">
        <Card className="transition-all duration-300 group-hover:border-primary group-hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center text-muted-foreground group-hover:text-primary">
              <Clock className="h-5 w-5 mr-2" /> PDKS Kayıtları
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Personel giriş çıkış kayıtlarını görüntüle ve raporla.
            </p>
          </CardContent>
        </Card>
      </Link>
      
      <Link to="/settings" className="group">
        <Card className="transition-all duration-300 group-hover:border-primary group-hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center text-muted-foreground group-hover:text-primary">
              <AlertCircle className="h-5 w-5 mr-2" /> Ayarlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sistem ayarlarını yapılandır ve kuralları düzenle.
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
};

export default QuickLinksGrid;
