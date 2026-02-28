
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const LandingHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-white font-bold mr-3">
              N
            </div>
            <span className="text-xl font-semibold text-gray-900">NGS Plus</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/login')}
            >
              Giriş Yap
            </Button>
            <Button 
              onClick={() => navigate('/demo-request')}
              className="bg-primary hover:bg-primary/90"
            >
              Demo İsteyin
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default LandingHeader;
