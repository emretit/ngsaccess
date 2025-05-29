
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const LandingHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-[#711A1A] rounded-md flex items-center justify-center text-white font-bold mr-3">
              P
            </div>
            <span className="text-xl font-semibold text-gray-900">PDKS Sistemi</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/demo-request')}
              className="border-[#711A1A] text-[#711A1A] hover:bg-[#711A1A] hover:text-white"
            >
              Demo Talep Et
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/login')}
            >
              Giriş Yap
            </Button>
            <Button 
              onClick={() => navigate('/register')}
              className="bg-[#711A1A] hover:bg-[#5a1515]"
            >
              Kayıt Ol
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default LandingHeader;
