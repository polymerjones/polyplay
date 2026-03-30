let cropAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!cropAudioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) throw new Error("AudioContext not available");
    cropAudioCtx = new Ctx();
  }
  return cropAudioCtx;
}

function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = frames * blockAlign;
  const wav = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wav);

  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  const channels = Array.from({ length: numChannels }, (_, index) => buffer.getChannelData(index));
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel]?.[frame] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([wav], { type: "audio/wav" });
}

export async function cropAudioBlobToWav(audioBlob: Blob, startSec: number, endSec: number): Promise<Blob> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const decoded = await getAudioContext().decodeAudioData(arrayBuffer.slice(0));
  const safeStart = Math.max(0, Math.min(decoded.duration, startSec));
  const safeEnd = Math.max(safeStart, Math.min(decoded.duration, endSec));
  const startFrame = Math.max(0, Math.floor(safeStart * decoded.sampleRate));
  const endFrame = Math.max(startFrame + 1, Math.ceil(safeEnd * decoded.sampleRate));
  const frameCount = Math.max(1, endFrame - startFrame);
  const cropped = new AudioBuffer({
    length: frameCount,
    numberOfChannels: decoded.numberOfChannels,
    sampleRate: decoded.sampleRate
  });

  for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
    const source = decoded.getChannelData(channel);
    cropped.copyToChannel(source.slice(startFrame, endFrame), channel, 0);
  }

  return encodeWav(cropped);
}
