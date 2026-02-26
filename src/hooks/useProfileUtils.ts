import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

interface ProfileData {
  email: string;
  fullName: string;
  photoUrl: string;
}

type ProfileType = {
  email?: string;
  fullName?: string;
  name?: string;
  photoUrl?: string;
  image?: string;
};

type UserType = {
  email?: string;
};

export function useProfileUtils() {
  const { user, profile } = useAuth();
  const typedProfile = profile as ProfileType | null;
  const typedUser = user as UserType | null;

  const [formData, setFormData] = useState<ProfileData>({
    email: "",
    fullName: "",
    photoUrl: "",
  });

  useEffect(() => {
    if (typedUser || typedProfile) {
      setFormData({
        email: typedUser?.email ?? typedProfile?.email ?? "",
        fullName:
          typedProfile?.fullName ??
          typedProfile?.name ??
          typedUser?.email?.split("@")[0] ??
          "",
        photoUrl: typedProfile?.photoUrl ?? typedProfile?.image ?? "",
      });
    }
  }, [typedUser, typedProfile]);

  const getUserInitials = () => {
    if (formData.fullName) {
      const nameParts = formData.fullName.split(" ");
      if (nameParts.length >= 2) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
      }
      return formData.fullName.substring(0, 2).toUpperCase();
    }
    return typedUser?.email?.substring(0, 2).toUpperCase() ?? "KU";
  };

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return { formData, getUserInitials, updateFormData };
}
