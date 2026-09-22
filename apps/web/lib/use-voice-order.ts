'use client';

import { useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import Fuse from 'fuse.js';
import { vibrateScanSuccess } from '@/lib/haptics';

export interface VoiceOrderProduct {
  id: string;
  name: string;
  selling_price: string | number;
  category?: string | null;
  unit?: string;
  barcode?: string | null;
  sku?: string | null;
  is_available?: boolean;
  stock_quantity?: number;
}

export interface ParsedVoiceItem {
  product: VoiceOrderProduct;
  quantity: number;
  rawQuery: string;
  matchScore: number;
}

// Hindi & Hinglish quantity words mapper
const HINDI_NUMBER_WORDS: Record<string, number> = {
  ek: 1,
  one: 1,
  do: 2,
  two: 2,
  teen: 3,
  three: 3,
  char: 4,
  chaar: 4,
  four: 4,
  paanch: 5,
  panch: 5,
  five: 5,
  chhe: 6,
  che: 6,
  six: 6,
  saat: 7,
  seven: 7,
  aath: 8,
  eight: 8,
  nau: 9,
  nine: 9,
  das: 10,
  ten: 10,
  gyarah: 11,
  barah: 12,
  aadha: 0.5,
  half: 0.5,
  dedh: 1.5,
  derh: 1.5,
  dhai: 2.5,
};

// Common filler words spoken at counter to strip before matching product name
const FILLER_WORDS = [
  'packet',
  'packets',
  'pkt',
  'pouch',
  'pouches',
  'bottle',
  'bottles',
  'strip',
  'strips',
  'tablet',
  'tablets',
  'kilo',
  'kg',
  'gm',
  'gram',
  'piece',
  'pcs',
  'dabba',
  'box',
  'boxes',
  'de do',
  'dedo',
  'chahiye',
  'daalo',
  'add karo',
  'aur',
  'bhi',
  'ka',
  'ki',
  'ke',
  'bhaiya',
  'please',
];

/**
 * Parses raw counter speech into matched catalog items with quantities
 */
export function parseVoiceOrderText(
  spokenText: string,
  catalog: VoiceOrderProduct[]
): ParsedVoiceItem[] {
  if (!spokenText || !spokenText.trim() || !catalog || catalog.length === 0) {
    return [];
  }

  // Setup Fuse fuzzy search engine
  const fuse = new Fuse(catalog, {
    keys: [
      { name: 'name', weight: 0.7 },
      { name: 'category', weight: 0.15 },
      { name: 'sku', weight: 0.1 },
      { name: 'barcode', weight: 0.05 },
    ],
    threshold: 0.5, // flexible matching for phonetic approximations
    includeScore: true,
    minMatchCharLength: 2,
  });

  // Split speech by common separators ("aur", "and", ",", "+", "fir")
  const rawSegments = spokenText
    .toLowerCase()
    .split(/\s*(?:,\s*|\baur\b|\band\b|\bfir\b|\bplus\b|\+|\n)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const matchedItems: ParsedVoiceItem[] = [];

  for (const segment of rawSegments) {
    let quantity = 1;
    let queryWords = segment.split(/\s+/);

    // 1. Look for numeric quantity at start or second word (e.g., "2 packet maggi" or "do maggi")
    const firstWord = queryWords[0];
    const secondWord = queryWords[1];

    if (/^\d+(\.\d+)?$/.test(firstWord)) {
      quantity = parseFloat(firstWord);
      queryWords.shift();
    } else if (HINDI_NUMBER_WORDS[firstWord] !== undefined) {
      quantity = HINDI_NUMBER_WORDS[firstWord];
      queryWords.shift();
    } else if (secondWord && /^\d+(\.\d+)?$/.test(secondWord)) {
      quantity = parseFloat(secondWord);
      queryWords.splice(1, 1);
    } else if (secondWord && HINDI_NUMBER_WORDS[secondWord] !== undefined) {
      quantity = HINDI_NUMBER_WORDS[secondWord];
      queryWords.splice(1, 1);
    }

    // 2. Filter out common filler words
    const cleanTokens = queryWords.filter((w) => !FILLER_WORDS.includes(w));
    const searchQuery = cleanTokens.join(' ').trim();

    if (!searchQuery) continue;

    // 3. Perform fuzzy catalog search
    const results = fuse.search(searchQuery);

    if (results.length > 0) {
      const topMatch = results[0];
      const matchScore = topMatch.score ?? 1;

      // Only accept if confidence score is reasonable (< 0.5 in Fuse means good match)
      if (matchScore <= 0.5) {
        matchedItems.push({
          product: topMatch.item,
          quantity: Math.max(0.1, quantity),
          rawQuery: segment,
          matchScore: 1 - matchScore,
        });
      }
    }
  }

  return matchedItems;
}

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
  const [error, setError] = useState<string | null>(null);

  // Browser Web Speech fallback ref
  const browserRecognitionRef = useRef<any>(null);

  const processTranscript = useCallback(
    (text: string) => {
      setTranscript(text);
      if (!text.trim()) return;

      const items = parseVoiceOrderText(text, catalog);
      setLastParsedItems(items);

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

  const startListening = useCallback(async () => {
    setError(null);
    setTranscript('');
    setLastParsedItems([]);

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      try {
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
    } else {
      // Desktop / Browser Web Speech API fallback
      const SpeechRecognitionAPI =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognitionAPI) {
        setError('Speech recognition not supported in this browser. Please use Chrome or Android.');
        return;
      }

      try {
        const recognition = new SpeechRecognitionAPI();
        recognition.lang = 'hi-IN';
        recognition.interimResults = true;
        recognition.maxAlternatives = 2;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onerror = (event: any) => {
          setIsListening(false);
          const errType = event?.error || '';
          if (errType === 'no-speech') {
            setError(null);
          } else {
            setError(`Microphone notice: ${errType}`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onresult = (event: any) => {
          let spoken = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            spoken += event.results[i][0].transcript;
          }
          setTranscript(spoken);

          if (event.results[0].isFinal) {
            setIsListening(false);
            processTranscript(spoken);
          }
        };

        browserRecognitionRef.current = recognition;
        recognition.start();
      } catch (err: any) {
        setError('Failed to start browser microphone: ' + err?.message);
        setIsListening(false);
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
    } else if (browserRecognitionRef.current) {
      try {
        browserRecognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  return {
    isListening,
    transcript,
    lastParsedItems,
    error,
    startListening,
    stopListening,
    processTranscript,
  };
}
