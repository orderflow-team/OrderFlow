import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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
});
