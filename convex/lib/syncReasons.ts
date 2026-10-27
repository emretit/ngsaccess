/** Why a device was skipped in a sync run. Dependency-free so the web can match the
 * stored text (src/lib/pastAttempt rewords some reasons in the past tense). */
export const skipReasons = {
  inactive: "Cihaz pasif", unsupported: "Cihaz markası desteklenmiyor",
  offline: "Cihaz çevrimdışı", configuration: "Cihaz bağlantı bilgileri eksik",
  noRule: "Cihaza bağlı gönderilecek aktif kural yok",
};
