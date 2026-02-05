import React, { useEffect, useMemo, useState } from 'react';
import { BusinessSettings } from '../types';

interface PWABannerProps {
  settings: BusinessSettings;
}

/**
 * Banner PWA "forçado" (Opção A):
 * - Mostra automaticamente em TODA visita (quando habilitado no Admin),
 *   mas some para quem já instalou.
 * - Android/Chrome: usa beforeinstallprompt quando disponível; se não, mostra instrução.
 * - iOS/Safari: não existe prompt automático, então mostra instrução.
 *
 * Observação: não existe um jeito 100% confiável de detectar "já instalou" quando a pessoa
 * está no navegador (principalmente iOS). Por isso gravamos um flag local quando:
 * - evento appinstalled dispara (Android/Chrome)
 * - usuário clica "Já instalei"
 */
const INSTALLED_KEY = 'pwa_installed_v1';
const HIDE_SESSION_KEY = 'pwa_hide_session_v1';

const PWABanner: React.FC<PWABannerProps> = ({ settings }) => {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  const isStandalone = useMemo(() => {
    try {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        // @ts-ignore
        (window.navigator as any).standalone === true
      );
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!settings.enablePWABanner) return;

    // Se está rodando como app (standalone), nunca mostra.
    if (isStandalone) return;

    // Se marcamos que já foi instalado, nunca mostra (mesmo no navegador).
    if (localStorage.getItem(INSTALLED_KEY) === '1') return;

    // Se o usuário fechou nessa sessão, não mostra de novo até fechar a aba/navegador.
    if (sessionStorage.getItem(HIDE_SESSION_KEY) === '1') return;

    // Detectar iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isIosDevice);

    // Mostra automaticamente após um pequeno delay (pra não "pular" na tela)
    const t = window.setTimeout(() => setShowBanner(true), 1200);

    // Captura o evento do Chrome (Android) quando disponível
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Quando instala, esconde e grava flag.
    const handleInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, '1');
      setShowBanner(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [settings.enablePWABanner, isStandalone]);

  const handleInstallClick = async () => {
    // Android/Chrome com suporte ao prompt
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        const choice = await deferredPrompt.userChoice;
        // Se aceitou, o appinstalled deve disparar, mas garantimos aqui também
        if (choice?.outcome === 'accepted') {
          localStorage.setItem(INSTALLED_KEY, '1');
          setShowBanner(false);
        }
      } catch {
        // ignora
      } finally {
        setDeferredPrompt(null);
      }
      return;
    }

    // Sem prompt (ex: alguns Androids/Chrome em situações específicas):
    // instrução: menu ⋮ → Instalar app
    alert('Para instalar: toque em ⋮ (menu do Chrome) e depois em "Instalar app" / "Adicionar à tela inicial".');
  };

  const handleDismissForSession = () => {
    sessionStorage.setItem(HIDE_SESSION_KEY, '1');
    setShowBanner(false);
  };

  const handleAlreadyInstalled = () => {
    // Usuário confirma que já instalou (útil no iOS)
    localStorage.setItem(INSTALLED_KEY, '1');
    setShowBanner(false);
  };

  if (!settings.enablePWABanner) return null;
  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in">
      <div className="bg-[#0B1F3B]/95 backdrop-blur-md border border-[#C1121F]/30 rounded-xl p-4 shadow-2xl flex flex-col gap-3 relative overflow-hidden">
        {/* Subtle Barber Pole Top Line */}
        <div className="absolute top-0 left-0 right-0 h-1 barber-pole"></div>

        <div className="flex justify-between items-start pt-2">
          <div className="flex-1">
            <h4 className="text-white font-bold font-oswald uppercase tracking-wide text-sm mb-1">
              {settings.name || 'Fio & Navalha'}
            </h4>
            <p className="text-gray-300 text-xs leading-relaxed">
              {settings.pwaBannerText || 'Adicione à tela inicial para agendar mais rápido!'}
            </p>
          </div>

          <button
            onClick={handleDismissForSession}
            className="text-gray-500 hover:text-white p-1 -mt-1 -mr-1"
            aria-label="Fechar"
            title="Fechar"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Buttons / Instructions */}
        {isIOS ? (
          <div className="bg-white/5 rounded p-2 text-[10px] text-gray-300 border border-white/10 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <i className="fas fa-share-square text-lg text-[#C1121F]"></i>
              <span>
                Toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.
              </span>
            </div>
            <button
              onClick={handleAlreadyInstalled}
              className="bg-white/5 hover:bg-white/10 text-white py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-colors border border-white/10"
            >
              Já instalei
            </button>
          </div>
        ) : (
          <div className="flex gap-3 mt-1">
            <button
              onClick={handleInstallClick}
              className="flex-1 bg-[#C1121F] hover:bg-[#A00F19] text-white py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors shadow-lg"
            >
              Instalar App
            </button>
            <button
              onClick={handleDismissForSession}
              className="px-4 py-2 rounded border border-white/10 text-white text-xs font-bold uppercase tracking-widest hover:bg-white/5"
            >
              Agora não
            </button>
          </div>
        )}

        {/* Pequeno link para quem já instalou no Android também */}
        {!isIOS && (
          <button
            onClick={handleAlreadyInstalled}
            className="text-[10px] text-gray-300 hover:text-white underline underline-offset-2 self-start mt-1"
          >
            Já instalei
          </button>
        )}
      </div>
    </div>
  );
};

export default PWABanner;
