'use client';

import { useEffect, useMemo, useState } from 'react';
import { Mic, MicOff, Volume2, Sparkles, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { useVoiceOrder, type VoiceOrderProduct, type ParsedVoiceItem } from '@/lib/use-voice-order';

interface VoiceOrderMicButtonProps {
  catalog: VoiceOrderProduct[];
  onItemsMatched: (items: ParsedVoiceItem[]) => void;
  autoStart?: boolean;
  className?: string;
}

export function VoiceOrderMicButton({
  catalog,
  onItemsMatched,
  autoStart = false,
  className = '',
}: VoiceOrderMicButtonProps) {
  const {
    isListening,
    transcript,
    lastParsedItems,
    error,
    startListening,
    stopListening,
    processTranscript,
  } = useVoiceOrder({
    catalog,
    onItemsMatched,
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-start voice recognition if requested (e.g. opened from dashboard mic stripe)
  useEffect(() => {
    if (autoStart) {
      const timer = setTimeout(() => {
        startListening();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoStart, startListening]);

  // Flash confirmation message when items are matched
  useEffect(() => {
    if (lastParsedItems.length > 0) {
      const names = lastParsedItems.map((i) => `${i.quantity}x ${i.product.name}`).join(', ');
      setToastMessage(`Added: ${names}`);
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [lastParsedItems]);

  // Dynamic suggestions derived from the active business catalog
  const sampleSuggestions = useMemo(() => {
    if (!catalog || catalog.length === 0) {
      return ['2 Dolo 650', '1 Paracetamol', '3 Maggi', 'Aadha kilo Chawal'];
    }
    const sampleNames = catalog
      .filter((p) => p.name && p.name.trim().length > 0)
      .slice(0, 4)
      .map((p, idx) => `${idx % 2 === 0 ? '2' : '1'} ${p.name}`);

    if (sampleNames.length < 3) {
      sampleNames.push('2 Dolo 650', '1 Paracetamol');
    }
    return sampleNames.slice(0, 4);
  }, [catalog]);

  const handleClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <>
      {/* ── Mic Trigger Button Beside Search Bar ── */}
      <div className={`relative inline-flex items-center shrink-0 ${className}`}>
        <button
          type="button"
          onClick={handleClick}
          title={isListening ? 'Stop listening' : 'Voice Order: Speak items to add to cart'}
          className={`relative inline-flex items-center justify-center h-12 px-4 rounded-full text-xs font-bold transition-all cursor-pointer select-none ${
            isListening
              ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 text-white shadow-lg shadow-blue-500/30 scale-105 ring-2 ring-emerald-400'
              : 'bg-white/60 hover:bg-white/80 text-blue-700 border border-blue-200/80 ring-1 ring-white/50 backdrop-blur-md shadow-xs'
          }`}
        >
          {isListening ? (
            <>
              {/* Ripple Pulse Rings */}
              <span className="absolute -inset-1 rounded-full bg-blue-500/30 animate-ping pointer-events-none" />
              <span className="w-2 h-2 rounded-full bg-emerald-300 mr-2 animate-pulse" />
              <Mic className="w-4 h-4 mr-1.5 animate-bounce text-white" />
              <span className="font-bold tracking-wide">Listening...</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 mr-1.5 text-blue-600" />
              <span>Voice</span>
            </>
          )}
        </button>

        {/* Small Floating Success Notification Toast */}
        {toastMessage && !isListening && (
          <div className="absolute right-0 top-full mt-2 z-50 whitespace-nowrap px-3 py-2 rounded-xl bg-emerald-600 text-white shadow-lg border border-emerald-500 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>

      {/* ── Full Native Voice Sheet (Fixed Bottom, Never Overflows Screen) ── */}
      {isListening && (
        <>
          {/* Dimmed Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[9998] animate-in fade-in duration-200"
            onClick={stopListening}
          />

          {/* Bottom Sheet Modal */}
          <div className="fixed inset-x-0 bottom-0 z-[9999] p-4 sm:p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] bg-slate-900/98 backdrop-blur-3xl border-t border-slate-700/80 text-white shadow-2xl rounded-t-[2.25rem] animate-in slide-in-from-bottom-6 duration-200">
            <div className="max-w-lg mx-auto space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex items-center justify-center w-6 h-6">
                    <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-1.5">
                      Voice-to-Order <Sparkles className="w-4 h-4 text-emerald-400" />
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Speak Hindi, English, or Hinglish
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={stopListening}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Close
                </button>
              </div>

              {/* Spoken Text Box */}
              <div className="min-h-[64px] rounded-2xl bg-white/5 border border-white/10 p-3.5 flex flex-col items-center justify-center text-center">
                {transcript ? (
                  <p className="text-base sm:text-lg font-bold text-white tracking-wide animate-in fade-in">
                    &ldquo;{transcript}&rdquo;
                  </p>
                ) : (
                  <p className="text-xs sm:text-sm text-slate-400 font-medium italic">
                    Listening for items &amp; quantities...
                  </p>
                )}
              </div>

              {/* Animated Equalizer Waveform */}
              <div className="flex items-center justify-center gap-1.5 h-7">
                <span className="w-1.5 h-3 bg-blue-400 rounded-full animate-pulse" />
                <span className="w-1.5 h-6 bg-indigo-400 rounded-full animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-7 bg-emerald-400 rounded-full animate-pulse [animation-delay:300ms]" />
                <span className="w-1.5 h-5 bg-teal-400 rounded-full animate-pulse [animation-delay:75ms]" />
                <span className="w-1.5 h-4 bg-emerald-400 rounded-full animate-pulse [animation-delay:225ms]" />
                <span className="w-1.5 h-6 bg-indigo-400 rounded-full animate-pulse [animation-delay:120ms]" />
                <span className="w-1.5 h-3 bg-blue-400 rounded-full animate-pulse [animation-delay:180ms]" />
              </div>

              {/* Suggestion Chips (Tappable!) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <span>Try saying (or tap to test):</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sampleSuggestions.map((phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      onClick={() => {
                        processTranscript(phrase);
                        stopListening();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/10 text-xs font-medium text-slate-200 transition-all text-left truncate max-w-full"
                    >
                      {phrase}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Notice if any */}
              {error && (
                <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
