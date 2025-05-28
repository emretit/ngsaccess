
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
    <div className="flex items-center justify-between mb-10">
      <div>
        <h3 className="text-3xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
          Kullanıcı Yönetimi
        </h3>
        <p className="text-purple-300 mt-2 text-lg">Sistem kullanıcılarını ve proje atamalarını yönetin</p>
      </div>
      <div className="flex items-center space-x-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-purple-400" />
          <Input
            type="search"
            placeholder="Kullanıcı ara..."
            className="w-80 pl-10 bg-white/10 border-white/20 text-white placeholder:text-purple-300 focus:bg-white/15 focus:border-purple-400 rounded-xl"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Button 
          onClick={onCreateUser}
          className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white font-bold px-8 py-4 rounded-xl shadow-xl hover:scale-105 transition-all duration-300 border-0"
        >
          <UserPlus className="h-5 w-5 mr-3" />
          Yeni Kullanıcı
        </Button>
      </div>
    </div>
  );
};
