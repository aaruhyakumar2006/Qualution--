use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub mod tableau;
pub use tableau::StabilizerTableau;

pub mod statevector;
pub use statevector::QuantumStatevector;

// ── 1. Canonical Circuit Input Structs ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gate {
    #[serde(alias = "type", alias = "gate")]
    pub gate_type: String,
    pub targets: Vec<i64>,
    #[serde(default)]
    pub column: u32,
    #[serde(default)]
    pub angle: Option<f64>,
    #[serde(default)]
    pub id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Measurement {
    pub qubit: i64,
    pub classical_bit: i64,
    #[serde(default)]
    pub column: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Circuit {
    pub qubits: i64,
    #[serde(default)]
    pub classical_bits: Option<i64>,
    #[serde(default)]
    pub gates: Vec<Gate>,
    #[serde(default)]
    pub measurements: Option<Vec<Measurement>>,
    #[serde(default)]
    pub shots: Option<u32>,
    #[serde(default)]
    pub measure: Option<bool>,
    #[serde(default)]
    pub seed: Option<u64>,
}

// ── 2. Unified Result Output Struct ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplexNumber {
    pub real: f64,
    pub imag: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceEstimate {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tableau_rows: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tableau_cols: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amplitudes: Option<usize>,
    pub memory_bytes: usize,
    pub memory_kb: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub status: String,
    pub backend: String,
    pub execution_location: String,
    pub execution_method: String,
    pub qubit_count: u32,
    pub shots: u32,
    pub counts: HashMap<String, u32>,
    pub probabilities: HashMap<String, f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub statevector: Option<Vec<ComplexNumber>>,
    pub runtime_ms: f64,
    pub warnings: Vec<String>,
    pub routing_reason: String,
    pub resource_estimate: ResourceEstimate,
}

// ── 3. Internal Normalized Representation ─────────────────────────────────

#[derive(Debug, Clone)]
struct PlannedMeasurement {
    qubit: usize,
    classical_bit: usize,
    column: u32,
}

#[derive(Debug, Clone)]
enum CircuitInstruction {
    Unitary(Gate),
    Measure(PlannedMeasurement),
}

#[derive(Debug, Clone)]
pub struct XorShift32 {
    s: u32,
}

impl XorShift32 {
    pub fn new(seed: u32) -> Self {
        Self {
            s: if seed == 0 { 1 } else { seed },
        }
    }

    #[inline(always)]
    pub fn next_f64(&mut self) -> f64 {
        self.s ^= self.s << 13;
        self.s ^= self.s >> 17;
        self.s ^= self.s << 5;
        (self.s as f64) / 4294967296.0
    }
}

pub fn make_js_error(msg: &str) -> JsValue {
    JsValue::from(js_sys::Error::new(msg))
}

/// Comprehensive input validation covering:
/// 1. Negative or zero qubit count
/// 2. Empty gates array
/// 3. Out-of-bounds target indices (< 0 or >= qubits)
/// 4. Missing target qubits
/// 5. Duplicate control/target on 2-qubit gates
/// 6. Out-of-bounds measurement qubits
pub fn validate_circuit_input(circuit: &Circuit) -> Result<(), JsValue> {
    if circuit.qubits <= 0 {
        return Err(make_js_error(&format!(
            "Invalid circuit: qubit count must be at least 1 (received {})",
            circuit.qubits
        )));
    }

    if circuit.gates.is_empty() {
        return Err(make_js_error(
            "Invalid circuit: gates array cannot be empty (no quantum operations to simulate)"
        ));
    }

    let num_qubits = circuit.qubits;

    for g in &circuit.gates {
        let raw_type = g.gate_type.trim().to_lowercase();
        let is_targetless = raw_type == "barrier" || raw_type == "id" || raw_type == "i" || raw_type == "reset";

        if g.targets.is_empty() && !is_targetless {
            return Err(make_js_error(&format!(
                "Invalid gate '{}': missing target qubit",
                g.gate_type
            )));
        }

        for &t in &g.targets {
            if t < 0 || t >= num_qubits {
                return Err(make_js_error(&format!(
                    "Invalid gate '{}': target qubit index {} is out of bounds for a {}-qubit circuit (valid indices: 0 to {})",
                    g.gate_type,
                    t,
                    num_qubits,
                    num_qubits - 1
                )));
            }
        }

        if matches!(raw_type.as_str(), "cx" | "cnot" | "cz" | "swap") {
            if g.targets.len() < 2 {
                return Err(make_js_error(&format!(
                    "Invalid gate '{}': requires at least 2 target qubits (got {})",
                    g.gate_type,
                    g.targets.len()
                )));
            }
            if g.targets[0] == g.targets[1] {
                return Err(make_js_error(&format!(
                    "Invalid gate '{}': control qubit and target qubit must be distinct (got duplicate qubit {})",
                    g.gate_type,
                    g.targets[0]
                )));
            }
        }
    }

    if let Some(ref measurements) = circuit.measurements {
        for m in measurements {
            if m.qubit < 0 || m.qubit >= num_qubits {
                return Err(make_js_error(&format!(
                    "Invalid measurement: qubit index {} is out of bounds for a {}-qubit circuit (valid indices: 0 to {})",
                    m.qubit,
                    num_qubits,
                    num_qubits - 1
                )));
            }
        }
    }

    Ok(())
}

fn apply_clifford_gate(tableau: &mut StabilizerTableau, gate_type: &str, targets: &[i64]) -> Result<(), JsValue> {
    let lower = gate_type.trim().to_lowercase();
    match lower.as_str() {
        "h" => {
            if targets.is_empty() { return Err(make_js_error("H gate requires 1 target qubit")); }
            tableau.apply_h(targets[0] as usize);
        }
        "s" => {
            if targets.is_empty() { return Err(make_js_error("S gate requires 1 target qubit")); }
            tableau.apply_s(targets[0] as usize);
        }
        "sdg" | "s_dagger" | "s-dagger" | "sdag" => {
            if targets.is_empty() { return Err(make_js_error("Sdg gate requires 1 target qubit")); }
            tableau.apply_sdg(targets[0] as usize);
        }
        "x" => {
            if targets.is_empty() { return Err(make_js_error("X gate requires 1 target qubit")); }
            tableau.apply_x(targets[0] as usize);
        }
        "y" => {
            if targets.is_empty() { return Err(make_js_error("Y gate requires 1 target qubit")); }
            tableau.apply_y(targets[0] as usize);
        }
        "z" => {
            if targets.is_empty() { return Err(make_js_error("Z gate requires 1 target qubit")); }
            tableau.apply_z(targets[0] as usize);
        }
        "cx" | "cnot" => {
            if targets.len() < 2 { return Err(make_js_error("CNOT gate requires control and target qubits")); }
            tableau.apply_cnot(targets[0] as usize, targets[1] as usize);
        }
        "cz" => {
            if targets.len() < 2 { return Err(make_js_error("CZ gate requires 2 target qubits")); }
            tableau.apply_cz(targets[0] as usize, targets[1] as usize);
        }
        "swap" => {
            if targets.len() < 2 { return Err(make_js_error("SWAP gate requires 2 target qubits")); }
            tableau.apply_swap(targets[0] as usize, targets[1] as usize);
        }
        "id" | "i" | "identity" | "barrier" | "reset" => {
            // Identity and barrier are no-ops
        }
        unsupported => {
            return Err(make_js_error(&format!(
                "Unsupported gate in stabilizer simulation: '{}'. Stabilizer simulation strictly requires Clifford circuits (H, S, Sdg, X, Y, Z, CX, CZ, SWAP).",
                unsupported
            )));
        }
    }
    Ok(())
}

// ── 4. WASM Exported Functions ────────────────────────────────────────────

#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

/// Sets up console_error_panic_hook so that Rust panics print full stack traces
/// to the browser/Worker console and surface as catchable JavaScript errors.
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}


/// Simulates a Clifford quantum circuit using the Aaronson-Gottesman stabilizer tableau formalism.
/// Runs in polynomial time O(N^2) gate evolution, ~O(N^3) measurement.
/// Can be invoked directly on the main thread or inside a dedicated Web Worker.
#[wasm_bindgen]
pub fn simulate_stabilizer_circuit(circuit_json: JsValue, shots_override: u32) -> Result<JsValue, JsValue> {
    // 1. Ensure panic hook is registered
    console_error_panic_hook::set_once();

    let start_time = js_sys::Date::now();

    // 2. Deserialize JS circuit object into Rust Circuit struct
    let circuit: Circuit = serde_wasm_bindgen::from_value(circuit_json)
        .map_err(|e| make_js_error(&format!("Invalid circuit input: {}", e)))?;

    // 2b. Strict Input Validation (negative qubits, empty gates, invalid target indices)
    validate_circuit_input(&circuit)?;

    let num_qubits = circuit.qubits as usize;

    let shots = if shots_override > 0 {
        shots_override
    } else {
        circuit.shots.unwrap_or(1024)
    };

    // 3. Extract and normalize unitary gates and inline measurements
    let mut unitary_gates: Vec<Gate> = Vec::new();
    let mut inline_measurements: Vec<PlannedMeasurement> = Vec::new();
    let mut max_col: i64 = -1;
    let mut min_measure_col: i64 = i64::MAX;
    let mut max_measure_col: i64 = -1;

    for g in circuit.gates {
        let raw_type = g.gate_type.trim().to_lowercase();
        let col = g.column as i64;
        if raw_type == "measure" {
            let target_qubit = g.targets.first().copied().unwrap_or(0) as usize;
            inline_measurements.push(PlannedMeasurement {
                qubit: target_qubit,
                classical_bit: 0, // Assigned below
                column: g.column,
            });
            min_measure_col = min_measure_col.min(col);
            max_measure_col = max_measure_col.max(col);
        } else {
            unitary_gates.push(g);
            max_col = max_col.max(col);
        }
    }

    unitary_gates.sort_by_key(|g| g.column);

    // 4. Determine planned measurements
    let mut planned_measurements: Vec<PlannedMeasurement> = Vec::new();

    if let Some(canonical_measurements) = circuit.measurements {
        if !canonical_measurements.is_empty() {
            for m in canonical_measurements {
                planned_measurements.push(PlannedMeasurement {
                    qubit: m.qubit as usize,
                    classical_bit: m.classical_bit as usize,
                    column: m.column.unwrap_or(0),
                });
            }
        }
    }

    if planned_measurements.is_empty() && !inline_measurements.is_empty() {
        inline_measurements.sort_by_key(|m| m.column);
        for (idx, m) in inline_measurements.into_iter().enumerate() {
            planned_measurements.push(PlannedMeasurement {
                qubit: m.qubit,
                classical_bit: idx,
                column: m.column,
            });
        }
    }

    if planned_measurements.is_empty() {
        // If no explicit measurement, default to measuring all qubits 0..n-1
        for q in 0..num_qubits {
            planned_measurements.push(PlannedMeasurement {
                qubit: q,
                classical_bit: q,
                column: 0,
            });
        }
    }

    let max_cbit = planned_measurements.iter().map(|m| m.classical_bit).max().unwrap_or(0);
    let num_classical_bits = (circuit.classical_bits.unwrap_or(0).max(0) as usize)
        .max(max_cbit + 1)
        .max(planned_measurements.len());

    let has_interleaved_measurements = !planned_measurements.is_empty()
        && max_measure_col >= 0
        && max_col > min_measure_col;

    // 5. High-speed pseudo-random generator: deterministic XorShift32 if seed provided, else SplitMix64
    let mut xorshift = circuit.seed.map(|s| XorShift32::new(s as u32));
    let mut fallback_seed = ((js_sys::Math::random() * 1e16) as u64) ^ 0x9E3779B97F4A7C15;
    let mut prng = move || -> f64 {
        if let Some(ref mut rng) = xorshift {
            rng.next_f64()
        } else {
            fallback_seed = fallback_seed.wrapping_add(0x9E3779B97F4A7C15);
            let mut z = fallback_seed;
            z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
            z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
            let val = z ^ (z >> 31);
            ((val >> 11) as f64) / 9007199254740992.0
        }
    };

    let mut counts: HashMap<String, u32> = HashMap::new();
    let mut bit_buf = vec![b'0'; num_classical_bits];

    if !has_interleaved_measurements {
        // ── Fast Path: Apply all unitary gates ONCE to the base tableau ──────
        let mut base_tableau = StabilizerTableau::new(num_qubits);
        for g in &unitary_gates {
            apply_clifford_gate(&mut base_tableau, &g.gate_type, &g.targets)?;
        }

        // For each shot, clone pre-measurement tableau and projectively measure
        for _ in 0..shots {
            let mut shot_tableau = base_tableau.clone();

            for m in &planned_measurements {
                let outcome = shot_tableau.measure(m.qubit, &mut prng);
                let cbit = m.classical_bit;
                if cbit < num_classical_bits {
                    // Qiskit / little-endian convention: classical bit c goes to index (num_cbits - 1 - c)
                    bit_buf[num_classical_bits - 1 - cbit] = b'0' + outcome;
                }
            }

            let bitstring = unsafe { String::from_utf8_unchecked(bit_buf.clone()) };
            *counts.entry(bitstring).or_insert(0) += 1;
        }
    } else {
        // ── Interleaved Measurements Path: Re-simulate per shot ─────────────
        let mut all_instructions: Vec<CircuitInstruction> = Vec::new();
        for g in unitary_gates {
            all_instructions.push(CircuitInstruction::Unitary(g));
        }
        for m in &planned_measurements {
            all_instructions.push(CircuitInstruction::Measure(m.clone()));
        }
        all_instructions.sort_by_key(|inst| match inst {
            CircuitInstruction::Unitary(g) => g.column,
            CircuitInstruction::Measure(m) => m.column,
        });

        for _ in 0..shots {
            let mut shot_tableau = StabilizerTableau::new(num_qubits);

            for inst in &all_instructions {
                match inst {
                    CircuitInstruction::Unitary(g) => {
                        apply_clifford_gate(&mut shot_tableau, &g.gate_type, &g.targets)?;
                    }
                    CircuitInstruction::Measure(m) => {
                        let outcome = shot_tableau.measure(m.qubit, &mut prng);
                        let cbit = m.classical_bit;
                        if cbit < num_classical_bits {
                            bit_buf[num_classical_bits - 1 - cbit] = b'0' + outcome;
                        }
                    }
                }
            }

            let bitstring = unsafe { String::from_utf8_unchecked(bit_buf.clone()) };
            *counts.entry(bitstring).or_insert(0) += 1;
        }
    }

    // 6. Compute probabilities
    let total_observed: u32 = counts.values().sum();
    let total_shots = if total_observed > 0 { total_observed } else { shots };
    let mut probabilities: HashMap<String, f64> = HashMap::new();
    for (bitstring, count) in &counts {
        probabilities.insert(bitstring.clone(), (*count as f64) / (total_shots as f64));
    }

    let end_time = js_sys::Date::now();
    let runtime_ms = ((end_time - start_time) * 100.0).round() / 100.0;

    let tableau_dimension = 2 * num_qubits + 1;
    let memory_bytes = tableau_dimension * tableau_dimension;

    let result = ExecutionResult {
        status: "success".to_string(),
        backend: "stabilizer_wasm_core".to_string(),
        execution_location: "wasm_worker".to_string(),
        execution_method: "stabilizer".to_string(),
        qubit_count: num_qubits as u32,
        shots,
        counts,
        probabilities,
        statevector: None,
        runtime_ms: runtime_ms.max(0.01),
        warnings: vec![],
        routing_reason: "Simulated via Aaronson-Gottesman polynomial-time Clifford stabilizer tableau in WebAssembly".to_string(),
        resource_estimate: ResourceEstimate {
            tableau_rows: Some(tableau_dimension),
            tableau_cols: Some(tableau_dimension),
            amplitudes: None,
            memory_bytes,
            memory_kb: ((memory_bytes as f64) / 1024.0 * 100.0).round() / 100.0,
        },
    };

    let serializer = serde_wasm_bindgen::Serializer::json_compatible();
    result.serialize(&serializer)
        .map_err(|e| make_js_error(&format!("Serialization error: {}", e)))
}

/// Simulates an arbitrary quantum circuit (including non-Clifford gates like T, Tdg, RX, RY, RZ, Phase)
/// using full-statevector amplitudes in WebAssembly.
/// Strictly capped at <= 20 qubits (~16 MB RAM) to prevent browser memory exhaustion.
#[wasm_bindgen]
pub fn simulate_statevector_circuit(circuit_json: JsValue, shots_override: u32) -> Result<JsValue, JsValue> {
    console_error_panic_hook::set_once();
    let start_time = js_sys::Date::now();

    let circuit: Circuit = serde_wasm_bindgen::from_value(circuit_json)
        .map_err(|e| make_js_error(&format!("Invalid circuit input: {}", e)))?;

    // Strict Input Validation (negative qubits, empty gates, invalid target indices)
    validate_circuit_input(&circuit)?;

    let num_qubits = circuit.qubits as usize;
    if num_qubits > 20 {
        let memory_mb = ((1usize << num_qubits) * 16) as f64 / (1024.0 * 1024.0);
        return Err(make_js_error(&format!(
            "Statevector simulation exceeds safe client memory limits for {} qubits (requires ~{:.1} MB statevector RAM; safe threshold is 20 qubits). Use stabilizer or remote cloud execution.",
            num_qubits, memory_mb
        )));
    }

    let shots = if shots_override > 0 {
        shots_override
    } else {
        circuit.shots.unwrap_or(1024)
    };

    let mut sv = QuantumStatevector::new(num_qubits)
        .map_err(|e| make_js_error(&e))?;

    // Sort gates chronologically
    let mut gates = circuit.gates;
    gates.sort_by_key(|g| g.column);

    // Apply gates
    for g in gates {
        let raw_type = g.gate_type.trim().to_lowercase();
        let target0 = g.targets.first().copied().unwrap_or(0) as usize;
        let target1 = g.targets.get(1).copied().unwrap_or(1) as usize;
        let angle = g.angle.unwrap_or(0.0);

        match raw_type.as_str() {
            "h" => sv.apply_h(target0),
            "x" => sv.apply_x(target0),
            "y" => sv.apply_y(target0),
            "z" => sv.apply_z(target0),
            "s" => sv.apply_s(target0),
            "sdg" | "s_dagger" | "s-dagger" | "sdag" => sv.apply_sdg(target0),
            "t" => sv.apply_t(target0),
            "tdg" | "t_dagger" | "t-dagger" => sv.apply_tdg(target0),
            "rx" => sv.apply_rx(target0, angle),
            "ry" => sv.apply_ry(target0, angle),
            "rz" => sv.apply_rz(target0, angle),
            "p" | "phase" | "u1" => sv.apply_p(target0, angle),
            "cx" | "cnot" => sv.apply_cnot(target0, target1),
            "cz" => sv.apply_cz(target0, target1),
            "swap" => sv.apply_swap(target0, target1),
            "id" | "i" | "identity" | "barrier" | "reset" | "measure" => {},
            unsupported => {
                return Err(make_js_error(&format!(
                    "Unsupported gate in statevector simulation: '{}'",
                    unsupported
                )));
            }
        }
    }

    // ── Analytical Probabilities ──────────────────────────────────────────
    let total = sv.size;
    let mut exact_probs = vec![0.0f64; total];
    let mut norm = 0.0f64;

    for k in 0..total {
        let r = sv.real[k];
        let c = sv.imag[k];
        let p = r * r + c * c;
        exact_probs[k] = p;
        norm += p;
    }

    if norm > 0.0 && (norm - 1.0).abs() > 1e-12 {
        let inv_norm = 1.0 / norm;
        for p in &mut exact_probs {
            *p *= inv_norm;
        }
    }

    // CDF for shot sampling
    let mut cdf = vec![0.0f64; total];
    let mut cum = 0.0f64;
    for k in 0..total {
        cum += exact_probs[k];
        cdf[k] = cum;
    }
    if total > 0 {
        cdf[total - 1] = 1.0;
    }

    // Determine measurements
    let mut planned_measurements: Vec<PlannedMeasurement> = Vec::new();
    if let Some(canonical_measurements) = circuit.measurements {
        if !canonical_measurements.is_empty() {
            for m in canonical_measurements {
                planned_measurements.push(PlannedMeasurement {
                    qubit: m.qubit as usize,
                    classical_bit: m.classical_bit as usize,
                    column: m.column.unwrap_or(0),
                });
            }
        }
    }
    if planned_measurements.is_empty() {
        for q in 0..num_qubits {
            planned_measurements.push(PlannedMeasurement {
                qubit: q,
                classical_bit: q,
                column: 0,
            });
        }
    }

    let max_cbit = planned_measurements.iter().map(|m| m.classical_bit).max().unwrap_or(0);
    let num_classical_bits = (circuit.classical_bits.unwrap_or(0).max(0) as usize)
        .max(max_cbit + 1)
        .max(planned_measurements.len());

    let is_default_full_measure = planned_measurements.len() == num_qubits
        && planned_measurements.iter().enumerate().all(|(idx, m)| m.qubit == idx && m.classical_bit == idx);

    let mut bitstring_cache: Vec<String> = Vec::with_capacity(total);
    let mut bit_buf = vec![b'0'; num_classical_bits];

    for k in 0..total {
        if is_default_full_measure {
            let mut s = String::with_capacity(num_qubits);
            for q in (0..num_qubits).rev() {
                if (k & (1 << q)) != 0 {
                    s.push('1');
                } else {
                    s.push('0');
                }
            }
            bitstring_cache.push(s);
        } else {
            for b in &mut bit_buf {
                *b = b'0';
            }
            for m in &planned_measurements {
                let bit_val = ((k >> m.qubit) & 1) as u8;
                let cbit = m.classical_bit;
                if cbit < num_classical_bits {
                    bit_buf[num_classical_bits - 1 - cbit] = b'0' + bit_val;
                }
            }
            let s = unsafe { String::from_utf8_unchecked(bit_buf.clone()) };
            bitstring_cache.push(s);
        }
    }

    // High-speed pseudo-random generator: deterministic XorShift32 if seed provided, else SplitMix64
    let mut xorshift = circuit.seed.map(|s| XorShift32::new(s as u32));
    let mut fallback_seed = ((js_sys::Math::random() * 1e16) as u64) ^ 0x9E3779B97F4A7C15;
    let mut prng = move || -> f64 {
        if let Some(ref mut rng) = xorshift {
            rng.next_f64()
        } else {
            fallback_seed = fallback_seed.wrapping_add(0x9E3779B97F4A7C15);
            let mut z = fallback_seed;
            z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
            z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
            let val = z ^ (z >> 31);
            ((val >> 11) as f64) / 9007199254740992.0
        }
    };

    // Sampling
    let mut counts: HashMap<String, u32> = HashMap::new();
    for _ in 0..shots {
        let r = prng();
        let mut low = 0;
        let mut high = total - 1;
        let mut chosen_idx = 0;

        while low <= high {
            let mid = (low + high) >> 1;
            if r <= cdf[mid] {
                chosen_idx = mid;
                if mid == 0 {
                    break;
                }
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        let bs = &bitstring_cache[chosen_idx];
        *counts.entry(bs.clone()).or_insert(0) += 1;
    }

    // Probabilities
    let mut probabilities: HashMap<String, f64> = HashMap::new();
    for k in 0..total {
        let raw_p = exact_probs[k];
        if raw_p > 1e-9 {
            let bs = &bitstring_cache[k];
            let rounded = if (raw_p - raw_p.round()).abs() < 1e-12 {
                raw_p.round()
            } else {
                ((raw_p * 1e8).round()) / 1e8
            };
            *probabilities.entry(bs.clone()).or_insert(0.0) += rounded;
        }
    }

    // Complex statevector amplitudes if total <= 1024
    let statevector = if total <= 1024 {
        let mut vec = Vec::with_capacity(total);
        for k in 0..total {
            vec.push(ComplexNumber {
                real: ((sv.real[k] * 1e6).round()) / 1e6,
                imag: ((sv.imag[k] * 1e6).round()) / 1e6,
            });
        }
        Some(vec)
    } else {
        None
    };

    let end_time = js_sys::Date::now();
    let runtime_ms = ((end_time - start_time) * 1000.0).round() / 1000.0;

    let memory_bytes = total * 16;
    let memory_kb = ((memory_bytes as f64) / 1024.0 * 100.0).round() / 100.0;

    let result = ExecutionResult {
        status: "success".to_string(),
        backend: "statevector_wasm_core".to_string(),
        execution_location: "wasm_worker".to_string(),
        execution_method: "statevector".to_string(),
        qubit_count: num_qubits as u32,
        shots,
        counts,
        probabilities,
        statevector,
        runtime_ms: runtime_ms.max(0.001),
        warnings: vec![],
        routing_reason: "Simulated via local in-place tensor-index full-statevector amplitudes in WebAssembly".to_string(),
        resource_estimate: ResourceEstimate {
            tableau_rows: None,
            tableau_cols: None,
            amplitudes: Some(total),
            memory_bytes,
            memory_kb,
        },
    };

    let serializer = serde_wasm_bindgen::Serializer::json_compatible();
    result.serialize(&serializer)
        .map_err(|e| make_js_error(&format!("Serialization error: {}", e)))
}

/// Boundary validation test helper from Phase 2
#[wasm_bindgen]
pub fn roundtrip_circuit_test(js_circuit: JsValue) -> Result<JsValue, JsValue> {
    console_error_panic_hook::set_once();
    simulate_stabilizer_circuit(js_circuit, 1024)
}

// ── 6. Supporting Router & Resource Guard Functions ─────────────────────────

pub const DEFAULT_SAFE_STATEVECTOR_QUBIT_CEILING: u32 = 20;

pub const CLIFFORD_GATES: &[&str] = &[
    "h", "x", "y", "z", "s", "sdg", "s_dagger", "sdag",
    "cx", "cnot", "cz", "swap", "id", "i", "barrier", "reset", "measure",
];

pub fn is_clifford_gate_name(name: &str) -> bool {
    let s = name.trim().to_ascii_lowercase();
    matches!(
        s.as_str(),
        "h" | "x"
            | "y"
            | "z"
            | "s"
            | "sdg"
            | "s_dagger"
            | "sdag"
            | "cx"
            | "cnot"
            | "cz"
            | "swap"
            | "id"
            | "i"
            | "barrier"
            | "reset"
            | "measure"
    )
}

#[derive(Deserialize)]
struct GenericGateItem {
    #[serde(default, alias = "type", alias = "gate")]
    gate: Option<String>,
}

#[derive(Deserialize)]
struct GenericCircuitInput {
    #[serde(default)]
    gates: Option<Vec<GenericGateItem>>,
}

/// Pure function: Checks if all gates in a circuit belong to the Clifford group.
/// Returns false on the first non-Clifford gate encountered, true otherwise.
/// An empty or missing circuit returns true.
/// Works with both CanonicalCircuit and backend CircuitRequest representations.
#[wasm_bindgen]
pub fn is_clifford_compatible(circuit_val: JsValue) -> bool {
    if circuit_val.is_null() || circuit_val.is_undefined() {
        return true;
    }

    if let Ok(parsed) = serde_wasm_bindgen::from_value::<GenericCircuitInput>(circuit_val) {
        if let Some(gates) = parsed.gates {
            for g in gates {
                match g.gate {
                    Some(name) => {
                        if !is_clifford_gate_name(&name) {
                            return false;
                        }
                    }
                    None => return false,
                }
            }
        }
        true
    } else {
        true
    }
}

/// Calculates estimated memory in bytes required for a statevector of n qubits:
/// 2^n amplitudes * 16 bytes (complex128: Float64 real + Float64 imag).
/// Caps at f64::MAX (equivalent to Number.MAX_VALUE) when exceeding 1020 exponent limits.
#[wasm_bindgen]
pub fn estimate_statevector_memory(qubit_count: i32) -> f64 {
    if qubit_count <= 0 {
        return 0.0;
    }
    if qubit_count > 1020 {
        return f64::MAX;
    }
    (2.0f64).powi(qubit_count) * 16.0
}

#[cfg(target_arch = "wasm32")]
fn detect_device_memory() -> Option<f64> {
    let global = js_sys::global();
    if let Ok(nav) = js_sys::Reflect::get(&global, &JsValue::from_str("navigator")) {
        if !nav.is_undefined() && !nav.is_null() {
            return js_sys::Reflect::get(&nav, &JsValue::from_str("deviceMemory"))
                .ok()
                .and_then(|v| v.as_f64());
        }
    }
    None
}

#[cfg(not(target_arch = "wasm32"))]
fn detect_device_memory() -> Option<f64> {
    None
}

/// Evaluates the safe client-side statevector qubit threshold.
/// Uses navigator.deviceMemory (GB) when available to grant a slightly higher threshold
/// on confirmed high-memory hardware, otherwise defaults to the conservative 20-qubit cap.
#[wasm_bindgen]
pub fn get_safe_statevector_qubit_threshold(device_memory_gb: Option<f64>) -> u32 {
    let ram_gb = match device_memory_gb {
        Some(ram) => Some(ram),
        None => detect_device_memory(),
    };

    match ram_gb {
        Some(ram) if ram >= 8.0 => 24,
        Some(ram) if ram >= 4.0 => 22,
        _ => DEFAULT_SAFE_STATEVECTOR_QUBIT_CEILING,
    }
}

#[wasm_bindgen]
pub fn get_default_safe_statevector_qubit_ceiling() -> u32 {
    DEFAULT_SAFE_STATEVECTOR_QUBIT_CEILING
}

/// Pure numerical computation of classical state fidelity (Bhattacharyya coefficient squared):
/// F = (sum_{x} sqrt(P_ideal(x) * P_noisy(x)))^2
/// Clamped strictly to [0.0, 1.0].
pub fn compute_distribution_fidelity_internal(
    ideal: &HashMap<String, f64>,
    noisy: &HashMap<String, f64>,
) -> f64 {
    if ideal.is_empty() || noisy.is_empty() {
        return 0.0;
    }

    let mut overlap_sum = 0.0;

    // Iterate through the smaller map for identical performance and logic
    let (primary, secondary) = if ideal.len() <= noisy.len() {
        (ideal, noisy)
    } else {
        (noisy, ideal)
    };

    for (outcome, &p1) in primary.iter() {
        if p1 > 0.0 {
            if let Some(&p2) = secondary.get(outcome) {
                if p2 > 0.0 {
                    overlap_sum += (p1 * p2).sqrt();
                }
            }
        }
    }

    let fidelity = overlap_sum * overlap_sum;
    fidelity.clamp(0.0, 1.0)
}

/// WASM-exported classical distribution fidelity calculation.
/// Accepts ideal and noisy probability maps as JsValue (JS Objects) and returns the fidelity as f64.
#[wasm_bindgen]
pub fn compute_distribution_fidelity(
    ideal_json: JsValue,
    noisy_json: JsValue,
) -> Result<f64, JsValue> {
    let ideal: HashMap<String, f64> = serde_wasm_bindgen::from_value(ideal_json)
        .map_err(|e| make_js_error(&format!("Invalid ideal distribution: {}", e)))?;
    let noisy: HashMap<String, f64> = serde_wasm_bindgen::from_value(noisy_json)
        .map_err(|e| make_js_error(&format!("Invalid noisy distribution: {}", e)))?;

    Ok(compute_distribution_fidelity_internal(&ideal, &noisy))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_clifford_gate_name() {
        assert!(is_clifford_gate_name("h"));
        assert!(is_clifford_gate_name("H"));
        assert!(is_clifford_gate_name("cx"));
        assert!(is_clifford_gate_name("cnot"));
        assert!(is_clifford_gate_name("s_dagger"));
        assert!(is_clifford_gate_name("sdg"));
        assert!(is_clifford_gate_name("measure"));
        assert!(!is_clifford_gate_name("t"));
        assert!(!is_clifford_gate_name("rx"));
        assert!(!is_clifford_gate_name("rz"));
        assert!(!is_clifford_gate_name("ccx"));
    }

    #[test]
    fn test_estimate_statevector_memory_formula() {
        assert_eq!(estimate_statevector_memory(0), 0.0);
        assert_eq!(estimate_statevector_memory(-1), 0.0);
        assert_eq!(estimate_statevector_memory(-5), 0.0);
        assert_eq!(estimate_statevector_memory(1), 32.0); // 2^1 * 16
        assert_eq!(estimate_statevector_memory(2), 64.0); // 2^2 * 16
        assert_eq!(estimate_statevector_memory(5), 512.0); // 2^5 * 16
        assert_eq!(estimate_statevector_memory(10), 16384.0); // 2^10 * 16
        assert_eq!(estimate_statevector_memory(20), 16777216.0); // 2^20 * 16
        assert_eq!(estimate_statevector_memory(22), 67108864.0); // 2^22 * 16
        assert_eq!(estimate_statevector_memory(25), 536870912.0); // 2^25 * 16
        assert_eq!(estimate_statevector_memory(30), 17179869184.0); // 2^30 * 16
        assert_eq!(estimate_statevector_memory(1025), f64::MAX);
    }

    #[test]
    fn test_safe_statevector_threshold_logic() {
        assert_eq!(get_safe_statevector_qubit_threshold(None), 20);
        assert_eq!(get_safe_statevector_qubit_threshold(Some(2.0)), 20);
        assert_eq!(get_safe_statevector_qubit_threshold(Some(4.0)), 22);
        assert_eq!(get_safe_statevector_qubit_threshold(Some(8.0)), 24);
        assert_eq!(get_safe_statevector_qubit_threshold(Some(16.0)), 24);
    }

    #[test]
    fn test_compute_distribution_fidelity_identical() {
        let mut ideal = HashMap::new();
        ideal.insert("11".to_string(), 1.0);
        let noisy = ideal.clone();
        let f = compute_distribution_fidelity_internal(&ideal, &noisy);
        assert!((f - 1.0).abs() < 1e-12);
    }

    #[test]
    fn test_compute_distribution_fidelity_disjoint() {
        let mut ideal = HashMap::new();
        ideal.insert("00".to_string(), 1.0);
        let mut noisy = HashMap::new();
        noisy.insert("11".to_string(), 1.0);
        let f = compute_distribution_fidelity_internal(&ideal, &noisy);
        assert_eq!(f, 0.0);
    }

    #[test]
    fn test_compute_distribution_fidelity_hand_computed() {
        let mut ideal = HashMap::new();
        ideal.insert("0".to_string(), 0.5);
        ideal.insert("1".to_string(), 0.5);
        let mut noisy = HashMap::new();
        noisy.insert("0".to_string(), 0.8);
        noisy.insert("1".to_string(), 0.2);
        let f = compute_distribution_fidelity_internal(&ideal, &noisy);
        assert!((f - 0.9).abs() < 1e-12);
    }

    #[test]
    fn test_compute_distribution_fidelity_phase1_grover() {
        let mut ideal = HashMap::new();
        ideal.insert("11".to_string(), 1.0);
        let mut noisy = HashMap::new();
        noisy.insert("00".to_string(), 0.007);
        noisy.insert("01".to_string(), 0.026);
        noisy.insert("10".to_string(), 0.034);
        noisy.insert("11".to_string(), 0.933);
        let f = compute_distribution_fidelity_internal(&ideal, &noisy);
        assert!((f - 0.933).abs() < 1e-12);
    }
}

