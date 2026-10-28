export const BEAUTY_PARTY_ANNOUNCEMENT_STORAGE_KEY = "mp_beauty_party";

export function hasSeenBeautyPartyAnnouncement(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(BEAUTY_PARTY_ANNOUNCEMENT_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markBeautyPartyAnnouncementSeen(): void {
  try {
    window.localStorage.setItem(BEAUTY_PARTY_ANNOUNCEMENT_STORAGE_KEY, "1");
  } catch {
    /* quota / private mode */
  }
}
