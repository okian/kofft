// Test script to verify the new Rust-based WASM module can extract album art
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testRustWASMMetadata() {
  try {
    console.log("🔧 Testing new Rust-based WASM metadata extraction...");

    // Import the WASM module
    const wasmModule = await import("./wasm/react_spectrogram_wasm.js");

    console.log("✅ WASM module loaded successfully");

    // Initialize the module properly
    await wasmModule.default();
    console.log("✅ WASM module initialized");

    // Create a metadata extractor
    const extractor = new wasmModule.MetadataExtractor();
    console.log("✅ MetadataExtractor created");

    // Test with the audio files
    const testFiles = [
      "test-fixtures/adele-skyfall-30s.m4a",
      "test-fixtures/perfect-circle-passive-30s.mp3",
      "test-fixtures/adele-skyfall.flac",
      "test-fixtures/perfect-circle-passive.flac",
    ];

    for (const testFile of testFiles) {
      try {
        const filePath = join(__dirname, testFile);
        const fileData = readFileSync(filePath);
        const filename = testFile.split("/").pop();

        console.log(`\n📁 Testing: ${filename}`);
        console.log(`📊 File size: ${fileData.length} bytes`);

        // Extract metadata using the new Rust WASM module
        const metadata = extractor.extract_metadata(fileData, filename);

        console.log("📋 Extracted metadata:");
        console.log(`   Title: ${metadata.title || "N/A"}`);
        console.log(`   Artist: ${metadata.artist || "N/A"}`);
        console.log(`   Album: ${metadata.album || "N/A"}`);
        console.log(`   Year: ${metadata.year || "N/A"}`);
        console.log(`   Genre: ${metadata.genre || "N/A"}`);
        console.log(`   Format: ${metadata.format || "N/A"}`);

        // Check for album art
        if (metadata.album_art && metadata.album_art.length > 0) {
          console.log(`🎨 Album art found!`);
          console.log(`   Size: ${metadata.album_art.length} bytes`);
          console.log(`   MIME type: ${metadata.album_art_mime || "unknown"}`);

          // Check if it looks like valid image data
          const header = metadata.album_art.slice(0, 8);
          console.log(
            `   Header bytes: ${Array.from(header)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join(" ")}`,
          );

          if (header[0] === 0xff && header[1] === 0xd8) {
            console.log("   ✅ Valid JPEG header detected");
          } else if (
            header[0] === 0x89 &&
            header[1] === 0x50 &&
            header[2] === 0x4e &&
            header[3] === 0x47
          ) {
            console.log("   ✅ Valid PNG header detected");
          } else if (
            header[0] === 0x47 &&
            header[1] === 0x49 &&
            header[2] === 0x46
          ) {
            console.log("   ✅ Valid GIF header detected");
          } else {
            console.log("   ⚠️ Unknown image format");
          }
        } else {
          console.log("❌ No album art found");
        }
      } catch (error) {
        console.error(`❌ Error testing ${testFile}:`, error.message);
      }
    }

    // Clean up
    extractor.free();
    console.log("\n✅ Cleanup completed");
  } catch (error) {
    console.error("❌ Error testing Rust WASM metadata extraction:", error);
  }
}

// Run the test
testRustWASMMetadata();
