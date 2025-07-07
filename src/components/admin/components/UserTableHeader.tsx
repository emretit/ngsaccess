
import React from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface UserTableHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreateUser: () => void;
}

export const UserTableHeader: React.FC<UserTableHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onCreateUser
}) => {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Kullanıcı Yönetimi
        </h2>
        <p className="text-muted-foreground mt-1">Sistem kullanıcılarını ve proje atamalarını yönetin</p>
      </div>
      <div className="flex items-center space-x-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Kullanıcı ara..."
            className="w-80 pl-10"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Button 
          onClick={onCreateUser}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Yeni Kullanıcı
        </Button>
      </div>
    </div>
  );
};
