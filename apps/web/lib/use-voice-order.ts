'use client';

import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { vibrateScanSuccess } from '@/lib/haptics';

import {
  parseVoiceOrder,
  parseVoiceOrderText,
  type ParsedVoiceItem,
  type VoiceChoice,
  type VoiceOrderProduct,
} from '@/lib/voice-order-parser';

// The parsing itself lives in voice-order-parser.ts (pure logic, tested without a phone).
export { parseVoiceOrderText };
export type { ParsedVoiceItem, VoiceChoice, VoiceOrderProduct };

/**
 * React hook providing native speech recognition with browser fallback
 */
export function useVoiceOrder({
  catalog,
  onItemsMatched,
}: {
  catalog: VoiceOrderProduct[];
  onItemsMatched?: (items: ParsedVoiceItem[]) => void;
}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastParsedItems, setLastParsedItems] = useState<ParsedVoiceItem[]>([]);
  // Spoken items nothing in the catalog matched — shown so a missing item is noticed, not silently lost.
  const [lastUnmatched, setLastUnmatched] = useState<string[]>([]);
  // Items that fit several products equally ("maggi" → 70g / 140g); the cashier picks.
  const [pendingChoices, setPendingChoices] = useState<VoiceChoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const processTranscript = useCallback(
    (text: string) => {
      setTranscript(text);
      setLastUnmatched([]);
      setPendingChoices([]);
      if (!text.trim()) return;

      const { items, choices, unmatched } = parseVoiceOrder(text, catalog);
      setLastParsedItems(items);
      setLastUnmatched(unmatched);
      setPendingChoices(choices);

      if (items.length > 0) {
        try {
          vibrateScanSuccess();
        } catch {
          // ignore haptics error on unsupported devices
        }
        if (onItemsMatched) {
          onItemsMatched(items);
        }
      }
    },
    [catalog, onItemsMatched]
  );

  /** The cashier picked one of the products an ambiguous phrase could mean. */
  const resolveChoice = useCallback(
    (choice: VoiceChoice, product: VoiceOrderProduct) => {
      setPendingChoices((current) => current.filter((c) => c !== choice));
      const item: ParsedVoiceItem = {
        product,
        quantity: choice.quantity,
        rawQuery: choice.rawQuery,
        matchScore: 1,
        ...(product.is_available === false ? { outOfStock: true } : {}),
      };
      setLastParsedItems((current) => [...current, item]);
      onItemsMatched?.([item]);
    },
    [onItemsMatched]
  );

  const dismissChoice = useCallback((choice: VoiceChoice) => {
    setPendingChoices((current) => current.filter((c) => c !== choice));
  }, []);

  const startListening = useCallback(async () => {
    // Voice ordering is strictly supported on native mobile (Capacitor Android/iOS) with SpeechRecognition plugin
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('SpeechRecognition')) {
      return;
    }

    setError(null);
    setTranscript('');
    setLastParsedItems([]);
    setLastUnmatched([]);
    setPendingChoices([]);

    try {
      // Verify device has speech recognition engine available
      const avail = await SpeechRecognition.available().catch(() => ({ available: false }));
      if (!avail?.available) {
        setError('Voice recognition is not available on this device');
        return;
      }

      // Request & check microphone permission
      const perm = await SpeechRecognition.checkPermissions();
      if (perm.speechRecognition !== 'granted') {
        const req = await SpeechRecognition.requestPermissions();
        if (req.speechRecognition !== 'granted') {
          setError('Microphone permission required for voice billing');
          return;
        }
      }

      setIsListening(true);

      // Native Android / iOS Speech Engine
      // Listen for live partial / final speech results
      await SpeechRecognition.removeAllListeners();

      await SpeechRecognition.addListener('listeningState', (state: { status: 'started' | 'stopped' }) => {
        if (state.status === 'stopped') {
          setIsListening(false);
        }
      });

      await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
        if (data.matches && data.matches.length > 0) {
          setTranscript(data.matches[0]);
        }
      });

      const res = await SpeechRecognition.start({
        language: 'hi-IN', // Supports Indian English & Hindi code-mixing
        maxResults: 2,
        prompt: 'Speak items to bill (e.g. 2 Maggi, ek pouch doodh)...',
        partialResults: false,
        popup: false,
      });

      setIsListening(false);
      if (res && res.matches && res.matches.length > 0) {
        processTranscript(res.matches[0]);
      }
    } catch (err: any) {
      setIsListening(false);
      const errStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err) || '');
      const isBenign = /no match|no speech|timeout|canceled|cancelled|client/i.test(errStr);
      if (isBenign) {
        // Normal silence timeout from Android SpeechRecognizer — do not log to console.error
        setError(null);
      } else {
        setError(err?.message || errStr || 'Failed to start native microphone');
      }
    }
  }, [processTranscript]);

  const stopListening = useCallback(async () => {
    setIsListening(false);
    if (Capacitor.isNativePlatform()) {
      try {
        await SpeechRecognition.stop();
        await SpeechRecognition.removeAllListeners();
      } catch {
        // ignore
      }
    }
  }, []);

  return {
    isListening,
    transcript,
    lastParsedItems,
    lastUnmatched,
    pendingChoices,
    resolveChoice,
    dismissChoice,
    error,
    startListening,
    stopListening,
    processTranscript,
  };
}
