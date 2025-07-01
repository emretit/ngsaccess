
import { useState, useEffect } from "react";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { GeneralSettings } from "@/components/settings/sections/GeneralSettings";
import { ShiftSettings } from "@/components/settings/sections/ShiftSettings";
import { NotificationSettings } from "@/components/settings/sections/NotificationSettings";
import { MailSettings } from "@/components/settings/sections/MailSettings";
import { UserManagement } from "@/components/settings/sections/UserManagement";
import { OnboardingProgress } from "@/components/settings/OnboardingProgress";
import { StepNavigation } from "@/components/settings/StepNavigation";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ONBOARDING_STEPS = [
  { key: "general", label: "Şirket Bilgileri", required: true },
  { key: "users", label: "Kullanıcı Yönetimi", required: true },
  { key: "schedule", label: "Vardiya Ayarları", required: true },
  { key: "mail", label: "Mail Ayarları", required: false },
  { key: "notifications", label: "Bildirim Ayarları", required: false }
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const { toast } = useToast();

  // Check if this is first-time setup
  useEffect(() => {
    const checkFirstTimeSetup = async () => {
      try {
        // Check if general settings exist
        const { data: generalSettings } = await supabase
          .from('general_settings')
          .select('id')
          .maybeSingle();

        // Check if any shifts exist
        const { data: shifts } = await supabase
          .from('shifts')
          .select('id')
          .limit(1);

        // Check if any users exist (besides the current user)
        const { data: users } = await supabase
          .from('users')
          .select('id');

        const hasGeneralSettings = !!generalSettings;
        const hasShifts = shifts && shifts.length > 0;
        const hasMultipleUsers = users && users.length > 1;

        // Determine completed steps
        const completed = [];
        if (hasGeneralSettings) completed.push("general");
        if (hasMultipleUsers) completed.push("users");
        if (hasShifts) completed.push("schedule");
        // For now, consider mail and notifications as optional/completed
        completed.push("mail", "notifications");

        setCompletedSteps(completed);
        setIsFirstTime(!hasGeneralSettings || !hasShifts);
      } catch (error) {
        console.error('Error checking setup status:', error);
      }
    };

    checkFirstTimeSetup();
  }, []);

  const handleStepComplete = (step: string) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps([...completedSteps, step]);
      toast({
        title: "Adım Tamamlandı",
        description: `${ONBOARDING_STEPS.find(s => s.key === step)?.label} başarıyla tamamlandı.`,
      });
    }
  };

  const canProceedToNext = (currentStep: string) => {
    const step = ONBOARDING_STEPS.find(s => s.key === currentStep);
    return !step?.required || completedSteps.includes(currentStep);
  };

  const renderActiveContent = () => {
    switch (activeTab) {
      case "general":
        return <GeneralSettings onComplete={() => handleStepComplete("general")} />;
      case "users":
        return <UserManagement onComplete={() => handleStepComplete("users")} />;
      case "schedule":
        return <ShiftSettings onComplete={() => handleStepComplete("schedule")} />;
      case "mail":
        return <MailSettings onComplete={() => handleStepComplete("mail")} />;
      case "notifications":
        return <NotificationSettings onComplete={() => handleStepComplete("notifications")} />;
      default:
        return <GeneralSettings onComplete={() => handleStepComplete("general")} />;
    }
  };

  const onboardingSteps = ONBOARDING_STEPS.map(step => ({
    ...step,
    completed: completedSteps.includes(step.key),
    current: step.key === activeTab
  }));

  const allRequiredStepsCompleted = ONBOARDING_STEPS
    .filter(step => step.required)
    .every(step => completedSteps.includes(step.key));

  return (
    <main className="flex-1 p-6 bg-gray-50 flex flex-col min-h-[calc(100vh-4rem)]">
      {isFirstTime && (
        <div className="mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">
              Hoş Geldiniz! 🎉
            </h2>
            <p className="text-blue-800">
              Sistemi kullanmaya başlamak için lütfen aşağıdaki adımları sırasıyla tamamlayın.
              Bu kurulum sürecinde size rehberlik edeceğiz.
            </p>
          </div>
          <OnboardingProgress steps={onboardingSteps} currentStep={activeTab} />
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <SettingsSidebar
          selected={activeTab}
          onSelect={setActiveTab}
          completedSteps={completedSteps}
          isOnboarding={isFirstTime}
        />
        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">
            {renderActiveContent()}
            
            {isFirstTime && (
              <StepNavigation
                currentStep={activeTab}
                steps={ONBOARDING_STEPS.map(s => s.key)}
                onStepChange={setActiveTab}
                canProceed={canProceedToNext(activeTab)}
              />
            )}

            {isFirstTime && allRequiredStepsCompleted && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  🎊 Tebrikler! Kurulum Tamamlandı
                </h3>
                <p className="text-green-800">
                  Tüm gerekli ayarları başarıyla tamamladınız. Artık sistemi kullanmaya başlayabilirsiniz!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
