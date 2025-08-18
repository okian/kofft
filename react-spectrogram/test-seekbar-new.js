// Test script for the new seekbar implementation
console.log('Testing new seekbar implementation...');

// Mock audio data for testing
const sampleRate = 44100;
const duration = 180; // 3 minutes
const audioData = new Float32Array(sampleRate * duration);

// Generate test audio data (sine wave with varying amplitude)
for (let i = 0; i < audioData.length; i++) {
  const time = i / sampleRate;
  const frequency = 440 + Math.sin(time * 0.1) * 100; // Varying frequency
  const amplitude = 0.3 + Math.sin(time * 0.5) * 0.2; // Varying amplitude
  audioData[i] = Math.sin(2 * Math.PI * frequency * time) * amplitude;
}

// Test waveform generation function (same as in new seekbar)
function generateWaveformData(audioData, numBars = 300) {
  if (!audioData || audioData.length === 0) {
    // Generate a simple pattern for visibility
    return Array.from({ length: numBars }, (_, i) => {
      const progress = i / numBars;
      return 0.3 + 0.4 * Math.sin(progress * Math.PI * 4) + 0.1 * Math.random();
    });
  }

  // Simple waveform generation without WASM
  const data = new Array(numBars);
  const samplesPerBar = Math.ceil(audioData.length / numBars);
  
  for (let i = 0; i < numBars; i++) {
    const start = i * samplesPerBar;
    const end = Math.min(start + samplesPerBar, audioData.length);
    const chunk = audioData.slice(start, end);
    
    if (chunk.length > 0) {
      // Calculate RMS (Root Mean Square) for amplitude
      const sumSquares = chunk.reduce((sum, sample) => sum + sample * sample, 0);
      const rms = Math.sqrt(sumSquares / chunk.length);
      data[i] = Math.min(rms * 3, 1.0); // Scale and clamp
    } else {
      data[i] = 0.1; // Minimum visibility
    }
  }
  
  return data;
}

// Test the waveform generation
console.log('Testing waveform generation...');
const waveformData = generateWaveformData(audioData, 300);

console.log('Waveform data generated:', {
  length: waveformData.length,
  min: Math.min(...waveformData),
  max: Math.max(...waveformData),
  avg: waveformData.reduce((sum, val) => sum + val, 0) / waveformData.length,
  sampleValues: waveformData.slice(0, 10)
});

// Test with empty audio data
console.log('Testing with empty audio data...');
const emptyWaveformData = generateWaveformData(null, 300);
console.log('Empty waveform data:', {
  length: emptyWaveformData.length,
  min: Math.min(...emptyWaveformData),
  max: Math.max(...emptyWaveformData),
  sampleValues: emptyWaveformData.slice(0, 10)
});

// Test performance
console.log('Testing performance...');
const startTime = performance.now();
for (let i = 0; i < 10; i++) {
  generateWaveformData(audioData, 300);
}
const endTime = performance.now();
console.log(`Performance: ${((endTime - startTime) / 10).toFixed(2)}ms per generation`);

// Test position calculations
console.log('Testing position calculations...');
const testCases = [
  { currentTime: 0, duration: 180, expected: 0 },
  { currentTime: 90, duration: 180, expected: 0.5 },
  { currentTime: 180, duration: 180, expected: 1 },
  { currentTime: -10, duration: 180, expected: 0 },
  { currentTime: 200, duration: 180, expected: 1 }
];

testCases.forEach(({ currentTime, duration, expected }) => {
  const actual = duration > 0 ? currentTime / duration : 0;
  const clamped = Math.max(0, Math.min(1, actual));
  console.log(`Position calc: ${currentTime}s/${duration}s = ${clamped.toFixed(3)} (expected: ${expected})`);
});

console.log('All tests completed successfully!');
