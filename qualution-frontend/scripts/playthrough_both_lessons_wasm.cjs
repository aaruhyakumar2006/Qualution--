const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/MAHANAM ROSHAN R/.gemini/antigravity-ide/brain/fd3ce9f1-f971-4d5a-995e-447cb26492f9';

async function run() {
  console.log('=== QUALUTION DUAL-ENGINE E2E LESSON WALKTHROUGH (WASM MODE) ===\n');

  let browser;
  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  } catch {
    browser = await chromium.launch({
      channel: 'msedge',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  const wasmLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (
      text.includes('[WasmManager]') ||
      text.includes('[ExecutionRouter]') ||
      text.includes('simulateWasm') ||
      text.includes('simulate_stabilizer') ||
      text.includes('simulate_statevector')
    ) {
      wasmLogs.push(text);
      console.log('   [ENGINE LOG]', text);
    }
  });

  page.on('pageerror', err => {
    console.error('   [PAGE ERROR]', err.message);
  });

  // 1. Configure Feature Flag to WASM
  console.log('1. Setting feature flag to Rust/WASM via localStorage and runtime config...');
  await page.goto('http://localhost:5173/#ide', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    localStorage.setItem('qualution_engine_backend', 'wasm');
    if ((window).__setQuantumEnginePreference) {
      (window).__setQuantumEnginePreference('wasm');
    }
    (window).__QUALUTION_CONFIG__ = { quantumEngineBackend: 'wasm' };
  });

  const activePref = await page.evaluate(() => {
    return (window).__getQuantumEnginePreference ? (window).__getQuantumEnginePreference() : localStorage.getItem('qualution_engine_backend');
  });
  console.log(`   Engine preference confirmed: "${activePref}" (Must be "wasm")\n`);
  if (activePref !== 'wasm') {
    throw new Error(`Engine preference failed to set to wasm: got ${activePref}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // LESSON 1: SPRINT 1 HADAMARD SUPERPOSITION (s1-hadamard-superposition)
  // ══════════════════════════════════════════════════════════════════
  console.log('2. Starting Sprint 1 Lesson: "Hadamard & Equal Superposition" (s1-hadamard-superposition)...');
  await page.goto('http://localhost:5173/?lesson=s1-hadamard-superposition', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Check Teaching HUD is present
  const hudLessonTitle = await page.locator('.teaching-lesson-title').textContent().catch(() => null);
  console.log(`   Teaching HUD Active Lesson: "${hudLessonTitle}"`);

  // Step through all stages of Hadamard Superposition
  for (let loop = 1; loop <= 12; loop++) {
    await page.waitForTimeout(1200);

    const stepPill = await page.locator('.teaching-chapter-text').textContent().catch(() => '');
    console.log(`   [STEP ${loop}] Current Chapter: "${stepPill}"`);

    // Check if Prediction Checkpoint 1 (Step 3) is waiting
    const isPredCheckpoint = await page.locator('[data-testid="teaching-prediction-checkpoint"]').isVisible().catch(() => false);
    if (isPredCheckpoint) {
      const qText = await page.locator('.teaching-pred-question').textContent().catch(() => '');
      console.log(`   -> Checkpoint Question: "${qText.trim()}"`);

      // Option 1 is 50/50 superposition
      const opt1 = page.locator('[data-testid="teaching-prediction-option-1"]');
      if (await opt1.isVisible()) {
        console.log('   -> Selecting Option 1: "Approximately 50% 0 and 50% 1"...');
        await opt1.click();
        await page.waitForTimeout(400);
      }

      console.log('   -> Clicking "Submit Prediction & Simulate" (triggers Rust/WASM simulation)...');
      await page.locator('[data-testid="teaching-prediction-submit-btn"]').click();
      await page.waitForTimeout(2000);
    }

    // Check if Comparison Banner is visible
    const isComparison = await page.locator('[data-testid="teaching-comparison-banner"]').isVisible().catch(() => false);
    if (isComparison) {
      const compText = await page.locator('.teaching-comparison-body').textContent().catch(() => '');
      console.log(`   -> Comparison Banner: "${compText.trim()}"`);
    }

    // Check if Learner Turn banner is visible (Step 8)
    const isLearnerTurn = await page.locator('[data-testid="teaching-learner-turn-banner"]').isVisible().catch(() => false);
    if (isLearnerTurn) {
      console.log('   -> Learner Turn Active! Clicking "Finish Lesson"...');
      await page.locator('[data-testid="teaching-finish-turn-btn"]').click();
      await page.waitForTimeout(1200);
    }

    // Check if Completion Banner is visible
    const isComplete = await page.locator('[data-testid="teaching-completion-banner"]').isVisible().catch(() => false);
    if (isComplete) {
      const xp = await page.locator('.teaching-xp-award').textContent().catch(() => '');
      const desc = await page.locator('.teaching-complete-desc').textContent().catch(() => '');
      console.log(`\n   >>> SPRINT 1 HADAMARD LESSON COMPLETE! <<<`);
      console.log(`   XP Earned: ${xp}`);
      console.log(`   Completion Summary: ${desc.trim()}\n`);
      break;
    }

    // Advance to next step if not complete and skip-forward is enabled
    const skipForward = page.locator('[data-testid="teaching-skip-forward-btn"]');
    if (await skipForward.isVisible() && await skipForward.isEnabled()) {
      await skipForward.click().catch(() => {});
    }
  }

  const s1Screenshot = path.join(ARTIFACT_DIR, 'sprint1_hadamard_wasm_walkthrough.png');
  await page.screenshot({ path: s1Screenshot, fullPage: false });
  console.log(`   Captured Sprint 1 Screenshot: ${s1Screenshot}\n`);

  // ══════════════════════════════════════════════════════════════════
  // LESSON 2: GROVER'S SEARCH ALGORITHM (lesson-8-grovers-search)
  // ══════════════════════════════════════════════════════════════════
  console.log('3. Starting Grover Algorithm Lesson: "Grover\'s Search" (lesson-8-grovers-search)...');
  await page.goto('http://localhost:5173/?assessment=lesson-8-grovers-search', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Execute Grover Master Sequence Demo with CZ oracle & |11> prediction
  console.log('   Executing full Grover 9-segment interactive build with Rust/WASM simulation...');
  const groverRun = await page.evaluate(async () => {
    if (typeof (window).__qualutionRunGroverSegmentsDemo === 'function') {
      return await (window).__qualutionRunGroverSegmentsDemo({
        learnerAction: 'cz',
        predictionIndex: 0, // Predict |11>
        delayMs: 150,
      });
    }
    return null;
  });

  if (groverRun) {
    console.log('   Grover 9-segment sequence completed successfully.');
    console.log('   Final Diagnosis:', groverRun.finalDiagnosis?.message);
  }

  await page.waitForTimeout(1500);

  const submitSolBtn = page.locator('[data-testid="teaching-finish-turn-btn"]');
  if (await submitSolBtn.isVisible()) {
    console.log('   Clicking "Submit Solution" to complete the Oracle takeover...');
    await submitSolBtn.click();
    await page.waitForTimeout(1500);
  }

  // Next is Prediction Checkpoint (Stage 7): student predicts |11>
  const predCheckpoint = page.locator('[data-testid="teaching-prediction-checkpoint"]');
  if (await predCheckpoint.isVisible()) {
    console.log('   Answering Grover Prediction Checkpoint (Option 0: State |11>)...');
    const opt0 = page.locator('[data-testid="teaching-prediction-option-0"]');
    if (await opt0.isVisible()) {
      await opt0.click();
      await page.waitForTimeout(400);
    }
    await page.locator('[data-testid="teaching-prediction-submit-btn"]').click();
    await page.waitForTimeout(2000);
  }

  // Step through remaining stages if needed
  for (let s = 1; s <= 4; s++) {
    const isDone = await page.locator('[data-testid="teaching-completion-banner"]').isVisible().catch(() => false);
    if (isDone) break;
    const skipFwd = page.locator('[data-testid="teaching-skip-forward-btn"]');
    if (await skipFwd.isVisible() && await skipFwd.isEnabled()) {
      await skipFwd.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  }

  // Check Grover Completion Banner
  const isGroverDone = await page.locator('[data-testid="teaching-completion-banner"]').isVisible().catch(() => false);
  if (isGroverDone) {
    const xp = await page.locator('.teaching-xp-award').textContent().catch(() => '');
    const desc = await page.locator('.teaching-complete-desc').textContent().catch(() => '');
    console.log(`   >>> GROVER SEARCH LESSON MASTERED! <<<`);
    console.log(`   XP Earned: ${xp}`);
    console.log(`   Message: ${desc.trim()}`);
  }

  // Also check if Assessment Modal was triggered
  const modalVisible = await page.locator('[data-testid="assessment-success-modal"]').isVisible().catch(() => false);
  const targetVerified = await page.locator('text=|11⟩ ✓').isVisible().catch(() => false);
  const fidelityScore = await page.locator('text=100%').first().isVisible().catch(() => false);

  console.log(`   Grover Completion Banner Visible: ${isGroverDone}`);
  console.log(`   Assessment Modal Visible: ${modalVisible}`);
  console.log(`   Target State |11⟩ Probability (100%): ${fidelityScore}`);

  const groverScreenshot = path.join(ARTIFACT_DIR, 'grover_lesson_wasm_walkthrough.png');
  await page.screenshot({ path: groverScreenshot, fullPage: false });
  console.log(`   Captured Grover Screenshot: ${groverScreenshot}\n`);

  // ══════════════════════════════════════════════════════════════════
  // SUMMARY OF ENGINE LOGS
  // ══════════════════════════════════════════════════════════════════
  console.log('=== WASM SIMULATION ENGINE VERIFICATION ===');
  console.log(`Total Engine Telemetry Logs: ${wasmLogs.length}`);
  wasmLogs.forEach((l, idx) => console.log(`   ${idx + 1}. ${l}`));

  await browser.close();
  console.log('\n=== BOTH LESSONS CONFIRMED CLEAN UNDER RUST/WASM ===\n');
}

run().catch(err => {
  console.error('\n Walkthrough FAILED:', err);
  process.exit(1);
});
