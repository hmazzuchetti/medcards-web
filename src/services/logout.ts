import { useReviewStore } from '@/stores/review-store';
import { useAuthStore } from '@/stores/auth-store';

export function getUnsyncedReviewsCount(): number {
  const { reviews } = useReviewStore.getState();
  return Object.values(reviews).filter(r => !r.synced).length;
}

export function shouldWarnBeforeLogout(): boolean {
  return getUnsyncedReviewsCount() > 0;
}

export function getLogoutConfirmationMessage(): string {
  const unsyncedCount = getUnsyncedReviewsCount();

  if (unsyncedCount === 0) {
    return 'Tem certeza que deseja sair?';
  }

  if (unsyncedCount === 1) {
    return `Voce tem 1 revisao nao sincronizada. Se sair agora, ela sera perdida. Deseja continuar?`;
  }

  return `Voce tem ${unsyncedCount} revisoes nao sincronizadas. Se sair agora, elas serao perdidas. Deseja continuar?`;
}

export async function performLogout(): Promise<void> {
  // Sign out from Supabase
  await useAuthStore.getState().signOut();

  // Clear local review data
  useReviewStore.getState().clearAllData();

  // Clear persisted localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('medcards-reviews');
    localStorage.removeItem('medcards-deck');
  }
}
