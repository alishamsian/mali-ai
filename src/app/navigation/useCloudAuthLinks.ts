import { appAlert } from '../../components/ui/AppAlert';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import { completeSignInFromUrl, isAuthRedirect } from '../../services/supabase/auth';
import { useFinanceStore } from '../../store/finance/store';
import { hapticSuccess, hapticWarn } from '../../utils/haptics';
import { t } from '../../i18n';

/**
 * Finishes cloud sign-in when the email link (poolet://auth?code=…) opens the app,
 * whether it was cold-started by the link or already running.
 */
export function useCloudAuthLinks(): void {
  useEffect(() => {
    let alive = true;
    const handle = async (url: string | null) => {
      if (!isAuthRedirect(url)) {
        return;
      }
      const copy = t().cloud;
      const result = await completeSignInFromUrl(url);
      if (!alive) {
        return;
      }
      if (!result.ok) {
        hapticWarn();
        appAlert(copy.failedTitle, copy.linkFailed);
        return;
      }
      const store = useFinanceStore.getState();
      // Everything already on the phone goes up once; later edits queue themselves.
      store.enqueueFullUpload();
      void store.flushCloud();
      hapticSuccess();
      appAlert(copy.signedInTitle, copy.signedInBody);
    };
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', event => void handle(event.url));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
}
