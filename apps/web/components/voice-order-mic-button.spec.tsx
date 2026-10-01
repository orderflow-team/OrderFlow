import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const isNativePlatformMock = vi.fn();
const isPluginAvailableMock = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatformMock(),
    isPluginAvailable: (name: string) => isPluginAvailableMock(name),
  },
}));

// Mock speech recognition & haptics
vi.mock('@capacitor-community/speech-recognition', () => ({
  SpeechRecognition: {
    available: vi.fn().mockResolvedValue({ available: true }),
    checkPermissions: vi.fn().mockResolvedValue({ speechRecognition: 'granted' }),
    requestPermissions: vi.fn().mockResolvedValue({ speechRecognition: 'granted' }),
    addListener: vi.fn().mockResolvedValue(undefined),
    removeAllListeners: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue({ matches: [] }),
    stop: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/haptics', () => ({
  vibrateScanSuccess: vi.fn(),
}));

import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { VoiceOrderMicButton } from './voice-order-mic-button';

describe('VoiceOrderMicButton', () => {
  beforeEach(() => {
    isNativePlatformMock.mockReset();
    isPluginAvailableMock.mockReset();
  });

  it('renders nothing on the web application', () => {
    isNativePlatformMock.mockReturnValue(false);
    isPluginAvailableMock.mockReturnValue(false);
    const { container } = render(
      <VoiceOrderMicButton catalog={[]} onItemsMatched={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on native mobile if SpeechRecognition plugin is not yet compiled in the APK', () => {
    isNativePlatformMock.mockReturnValue(true);
    isPluginAvailableMock.mockReturnValue(false);
    const { container } = render(
      <VoiceOrderMicButton catalog={[]} onItemsMatched={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the voice button on the native mobile application when plugin is available', () => {
    isNativePlatformMock.mockReturnValue(true);
    isPluginAvailableMock.mockReturnValue(true);
    render(
      <VoiceOrderMicButton catalog={[]} onItemsMatched={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: /Voice/i })).toBeInTheDocument();
  });

  describe('after something is said', () => {
    const catalog = [
      { id: 'm70', name: 'Maggi Noodles 70g', selling_price: 14 },
      { id: 'm140', name: 'Maggi Noodles 140g', selling_price: 28 },
      { id: 'namak', name: 'Sendha Namak', selling_price: 30 },
    ];

    const sayAndTapVoice = async (spoken: string, onItemsMatched = vi.fn()) => {
      isNativePlatformMock.mockReturnValue(true);
      isPluginAvailableMock.mockReturnValue(true);
      vi.mocked(SpeechRecognition.start).mockResolvedValueOnce({ matches: [spoken] } as any);
      render(<VoiceOrderMicButton catalog={catalog} onItemsMatched={onItemsMatched} />);
      fireEvent.click(screen.getByRole('button', { name: /Voice/i }));
      return onItemsMatched;
    };

    it('asks "Which one?" instead of guessing when two products fit equally, then adds the pick', async () => {
      const onItemsMatched = await sayAndTapVoice('2 maggi');

      expect(await screen.findByText('Which one?')).toBeInTheDocument();
      expect(onItemsMatched).not.toHaveBeenCalled(); // nothing added until the cashier chooses

      fireEvent.click(screen.getByRole('button', { name: /Maggi Noodles 140g/ }));

      await waitFor(() => expect(onItemsMatched).toHaveBeenCalledTimes(1));
      const [items] = onItemsMatched.mock.calls[0];
      expect(items[0]).toMatchObject({ quantity: 2, product: { id: 'm140' } });
      expect(screen.queryByText('Which one?')).not.toBeInTheDocument();
    });

    it('lets the cashier skip an ambiguous item', async () => {
      const onItemsMatched = await sayAndTapVoice('2 maggi');
      await screen.findByText('Which one?');

      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

      expect(screen.queryByText('Which one?')).not.toBeInTheDocument();
      expect(onItemsMatched).not.toHaveBeenCalled();
    });

    it('says what it could not find instead of dropping it silently', async () => {
      const onItemsMatched = await sayAndTapVoice('do namak aur cold drink');

      expect(await screen.findByText("Couldn't find: cold drink")).toBeInTheDocument();
      expect(onItemsMatched).toHaveBeenCalledTimes(1);
      expect(onItemsMatched.mock.calls[0][0][0]).toMatchObject({ quantity: 2, product: { id: 'namak' } });
    });

    it('shows the not-found notice even when nothing at all matched', async () => {
      const onItemsMatched = await sayAndTapVoice('bilkul anjaan cheez');

      expect(await screen.findByText(/Couldn't find: bilkul anjaan cheez/)).toBeInTheDocument();
      expect(onItemsMatched).not.toHaveBeenCalled();
    });
  });
});
