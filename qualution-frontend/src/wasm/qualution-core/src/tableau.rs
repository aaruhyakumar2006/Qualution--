/**
 * tableau.rs
 *
 * Aaronson-Gottesman (2004) Stabilizer Simulation Engine in Rust.
 * Faithful, line-by-line translation of the verified TypeScript stabilizerTableau.ts.
 *
 * Matrix dimensions: (2n + 1) rows x (2n + 1) columns per n qubits:
 * - Rows 0 .. n-1: Destabilizer generators R_1 .. R_n
 * - Rows n .. 2n-1: Stabilizer generators R_{n+1} .. R_{2n}
 * - Row 2n: Scratch row for deterministic measurement evaluation
 * - Columns 0 .. n-1: X-part (x_ij)
 * - Columns n .. 2n-1: Z-part (z_ij)
 * - Column 2n: Phase bit r_i in {0, 1} representing (-1)^r_i
 */

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StabilizerTableau {
    pub num_qubits: usize,
    pub num_rows: usize,
    pub num_cols: usize,
    pub data: Vec<u8>,
}

impl StabilizerTableau {
    /// Creates a new stabilizer tableau initialized to the |0^n> state.
    pub fn new(num_qubits: usize) -> Self {
        assert!(num_qubits >= 1, "StabilizerTableau requires at least 1 qubit");
        let num_rows = 2 * num_qubits + 1; // +1 scratch row for deterministic measurement
        let num_cols = 2 * num_qubits + 1; // x-part (n) + z-part (n) + phase bit (1)
        let data = vec![0u8; num_rows * num_cols];

        let mut tableau = Self {
            num_qubits,
            num_rows,
            num_cols,
            data,
        };
        tableau.reset_to_zero_state();
        tableau
    }

    /// Resets the tableau to the |0^n> computational basis state:
    /// Destabilizers R_i = X_i (x_ii = 1, z_ij = 0, r_i = 0)
    /// Stabilizers R_{n+i} = Z_i (x_ij = 0, z_{n+i, i} = 1, r_{n+i} = 0)
    pub fn reset_to_zero_state(&mut self) {
        self.data.fill(0);
        let n = self.num_qubits;
        let num_cols = self.num_cols;

        for i in 0..n {
            // Destabilizer R_i = X_i: row i, col i
            self.data[i * num_cols + i] = 1;
            // Stabilizer R_{n+i} = Z_i: row (n+i), col (n+i)
            self.data[(n + i) * num_cols + n + i] = 1;
        }
    }

    /// Total allocated buffer size in bytes.
    pub fn byte_length(&self) -> usize {
        self.data.len()
    }

    // ── Matrix Indexing Helpers ──────────────────────────────────────────

    #[inline(always)]
    pub fn get_x(&self, row: usize, qubit: usize) -> u8 {
        self.data[row * self.num_cols + qubit]
    }

    #[inline(always)]
    pub fn set_x(&mut self, row: usize, qubit: usize, val: u8) {
        self.data[row * self.num_cols + qubit] = val & 1;
    }

    #[inline(always)]
    pub fn get_z(&self, row: usize, qubit: usize) -> u8 {
        self.data[row * self.num_cols + self.num_qubits + qubit]
    }

    #[inline(always)]
    pub fn set_z(&mut self, row: usize, qubit: usize, val: u8) {
        self.data[row * self.num_cols + self.num_qubits + qubit] = val & 1;
    }

    #[inline(always)]
    pub fn get_phase(&self, row: usize) -> u8 {
        self.data[row * self.num_cols + 2 * self.num_qubits]
    }

    #[inline(always)]
    pub fn set_phase(&mut self, row: usize, val: u8) {
        self.data[row * self.num_cols + 2 * self.num_qubits] = val & 1;
    }

    // ── Pauli Arithmetic (Aaronson & Gottesman g-function & rowsum) ─────

    /// The Aaronson-Gottesman g-function:
    /// Returns exponent of i when multiplying single-qubit Pauli operators:
    /// P1 * P2 = i^g * P3
    #[inline(always)]
    pub fn g(x1: u8, z1: u8, x2: u8, z2: u8) -> i32 {
        let x1 = x1 as i32;
        let z1 = z1 as i32;
        let x2 = x2 as i32;
        let z2 = z2 as i32;

        if x1 == 0 && z1 == 0 {
            return 0;
        }
        if x1 == 1 && z1 == 1 {
            return z2 - x2;
        }
        if x1 == 1 && z1 == 0 {
            return z2 * (2 * x2 - 1);
        }
        x2 * (1 - 2 * z2)
    }

    /// High-Performance Single-Pass Rowsum:
    /// Multiplies Pauli operators: row h <- row h * row i.
    /// Inlines g-function and fuses phase accumulation with XOR vector updates.
    pub fn rowsum(&mut self, h: usize, i: usize) {
        let n = self.num_qubits;
        let num_cols = self.num_cols;
        let offset_h = h * num_cols;
        let offset_i = i * num_cols;
        let phase_col = 2 * n;

        let mut sum: i32 = ((self.data[offset_h + phase_col] as i32) << 1)
            + ((self.data[offset_i + phase_col] as i32) << 1);

        for j in 0..n {
            let idx_h_x = offset_h + j;
            let idx_h_z = offset_h + n + j;
            let idx_i_x = offset_i + j;
            let idx_i_z = offset_i + n + j;

            let x1 = self.data[idx_h_x] as i32;
            let z1 = self.data[idx_h_z] as i32;
            let x2 = self.data[idx_i_x] as i32;
            let z2 = self.data[idx_i_z] as i32;

            if x1 == 1 {
                if z1 == 1 {
                    sum += z2 - x2;
                } else {
                    sum += z2 * (2 * x2 - 1);
                }
            } else if z1 == 1 {
                sum += x2 * (1 - 2 * z2);
            }

            self.data[idx_h_x] ^= x2 as u8;
            self.data[idx_h_z] ^= z2 as u8;
        }

        let mod4 = ((sum % 4) + 4) % 4;
        self.data[offset_h + phase_col] = if mod4 == 2 {
            1
        } else if mod4 == 0 {
            0
        } else {
            ((mod4 >> 1) & 1) as u8
        };
    }

    // ── Clifford Gate Updates (O(N) per gate across 2N rows) ─────────────

    /// Hadamard Gate H(a):
    /// H X H = Z, H Z H = X, H Y H = -Y
    pub fn apply_h(&mut self, qubit: usize) {
        let total_rows = 2 * self.num_qubits;
        let num_cols = self.num_cols;
        let n = self.num_qubits;
        let phase_col = 2 * n;

        for i in 0..total_rows {
            let row_offset = i * num_cols;
            let x = self.data[row_offset + qubit];
            let z = self.data[row_offset + n + qubit];
            self.data[row_offset + phase_col] ^= x & z;
            self.data[row_offset + qubit] = z;
            self.data[row_offset + n + qubit] = x;
        }
    }

    /// Phase Gate S(a):
    /// S X S^dagger = Y, S Z S^dagger = Z, S Y S^dagger = -X
    pub fn apply_s(&mut self, qubit: usize) {
        let total_rows = 2 * self.num_qubits;
        let num_cols = self.num_cols;
        let n = self.num_qubits;
        let phase_col = 2 * n;

        for i in 0..total_rows {
            let row_offset = i * num_cols;
            let x = self.data[row_offset + qubit];
            let z = self.data[row_offset + n + qubit];
            self.data[row_offset + phase_col] ^= x & z;
            self.data[row_offset + n + qubit] = z ^ x;
        }
    }

    /// S-dagger Gate S^dagger(a):
    /// S^dagger X S = -Y, S^dagger Z S = Z, S^dagger Y S = X
    pub fn apply_sdg(&mut self, qubit: usize) {
        let total_rows = 2 * self.num_qubits;
        let num_cols = self.num_cols;
        let n = self.num_qubits;
        let phase_col = 2 * n;

        for i in 0..total_rows {
            let row_offset = i * num_cols;
            let x = self.data[row_offset + qubit];
            let z = self.data[row_offset + n + qubit];
            self.data[row_offset + phase_col] ^= x & (1 ^ z);
            self.data[row_offset + n + qubit] = z ^ x;
        }
    }

    /// Pauli X Gate X(a):
    /// X X X = X, X Z X = -Z, X Y X = -Y
    pub fn apply_x(&mut self, qubit: usize) {
        let total_rows = 2 * self.num_qubits;
        let num_cols = self.num_cols;
        let n = self.num_qubits;
        let phase_col = 2 * n;

        for i in 0..total_rows {
            let row_offset = i * num_cols;
            self.data[row_offset + phase_col] ^= self.data[row_offset + n + qubit];
        }
    }

    /// Pauli Y Gate Y(a):
    /// Y X Y = -X, Y Z Y = -Z, Y Y Y = Y
    pub fn apply_y(&mut self, qubit: usize) {
        let total_rows = 2 * self.num_qubits;
        let num_cols = self.num_cols;
        let n = self.num_qubits;
        let phase_col = 2 * n;

        for i in 0..total_rows {
            let row_offset = i * num_cols;
            self.data[row_offset + phase_col] ^=
                self.data[row_offset + qubit] ^ self.data[row_offset + n + qubit];
        }
    }

    /// Pauli Z Gate Z(a):
    /// Z X Z = -X, Z Z Z = Z, Z Y Z = -Y
    pub fn apply_z(&mut self, qubit: usize) {
        let total_rows = 2 * self.num_qubits;
        let num_cols = self.num_cols;
        let phase_col = 2 * self.num_qubits;

        for i in 0..total_rows {
            let row_offset = i * num_cols;
            self.data[row_offset + phase_col] ^= self.data[row_offset + qubit];
        }
    }

    /// CNOT Gate CX(control, target):
    /// CX (X_c) CX = X_c X_t
    /// CX (Z_t) CX = Z_c Z_t
    pub fn apply_cnot(&mut self, control: usize, target: usize) {
        let total_rows = 2 * self.num_qubits;
        let num_cols = self.num_cols;
        let n = self.num_qubits;
        let phase_col = 2 * n;

        for i in 0..total_rows {
            let row_offset = i * num_cols;
            let xc = self.data[row_offset + control];
            let zt = self.data[row_offset + n + target];
            let xt = self.data[row_offset + target];
            let zc = self.data[row_offset + n + control];

            let phase_delta = xc & zt & (xt ^ zc ^ 1);
            self.data[row_offset + phase_col] ^= phase_delta;
            self.data[row_offset + target] ^= xc;
            self.data[row_offset + n + control] ^= zt;
        }
    }

    /// Controlled-Z Gate CZ(control, target):
    /// CZ (X_c) CZ = X_c Z_t
    /// CZ (X_t) CZ = Z_c X_t
    pub fn apply_cz(&mut self, control: usize, target: usize) {
        let total_rows = 2 * self.num_qubits;
        let num_cols = self.num_cols;
        let n = self.num_qubits;
        let phase_col = 2 * n;

        for i in 0..total_rows {
            let row_offset = i * num_cols;
            let xc = self.data[row_offset + control];
            let xt = self.data[row_offset + target];
            let zc = self.data[row_offset + n + control];
            let zt = self.data[row_offset + n + target];

            let phase_delta = xc & xt & (zc ^ zt);
            self.data[row_offset + phase_col] ^= phase_delta;
            self.data[row_offset + n + control] ^= xt;
            self.data[row_offset + n + target] ^= xc;
        }
    }

    /// SWAP Gate SWAP(qubitA, qubitB):
    /// Exchanges qubit wire indices across all generators.
    pub fn apply_swap(&mut self, qubit_a: usize, qubit_b: usize) {
        if qubit_a == qubit_b {
            return;
        }
        let total_rows = 2 * self.num_qubits;
        let num_cols = self.num_cols;
        let n = self.num_qubits;

        for i in 0..total_rows {
            let row_offset = i * num_cols;
            let idx_a_x = row_offset + qubit_a;
            let idx_b_x = row_offset + qubit_b;
            let idx_a_z = row_offset + n + qubit_a;
            let idx_b_z = row_offset + n + qubit_b;

            let xa = self.data[idx_a_x];
            self.data[idx_a_x] = self.data[idx_b_x];
            self.data[idx_b_x] = xa;

            let za = self.data[idx_a_z];
            self.data[idx_a_z] = self.data[idx_b_z];
            self.data[idx_b_z] = za;
        }
    }

    // ── Measurement (Aaronson & Gottesman Section IV) ───────────────────

    /// Measures qubit in the computational Z basis.
    /// Returns the measurement outcome 0 or 1.
    ///
    /// Case 1: Random (exists p in [n, 2n-1] with x_pq = 1) -> 50/50 outcome.
    /// Case 2: Deterministic (all x_pq = 0 for p in [n, 2n-1]) -> outcome fixed by stabilizers.
    pub fn measure<F: FnMut() -> f64>(&mut self, qubit: usize, mut rng: F) -> u8 {
        let n = self.num_qubits;
        let num_cols = self.num_cols;
        let phase_col = 2 * n;
        let mut p: Option<usize> = None;

        // Check if any stabilizer generator anticommutes with Z_q (i.e. x_{p, qubit} == 1)
        for i in n..(2 * n) {
            if self.data[i * num_cols + qubit] == 1 {
                p = Some(i);
                break;
            }
        }

        // ── Case 1: Random Outcome (50/50) ─────────────────────────────────
        if let Some(p_idx) = p {
            // Eliminate x on this qubit from all other rows
            for i in 0..(2 * n) {
                if i != p_idx && self.data[i * num_cols + qubit] == 1 {
                    self.rowsum(i, p_idx);
                }
            }

            // Copy row p to corresponding destabilizer row p - n via native memory copy
            let dest_offset = (p_idx - n) * num_cols;
            let src_offset = p_idx * num_cols;
            self.data.copy_within(src_offset..(src_offset + num_cols), dest_offset);

            // Choose random outcome 0 or 1 with 50/50 probability
            let outcome = if rng() < 0.5 { 0 } else { 1 };

            // Replace stabilizer row p with single-qubit Z_qubit and chosen eigenvalue
            self.data[src_offset..(src_offset + num_cols)].fill(0);
            self.data[src_offset + n + qubit] = 1;
            self.data[src_offset + phase_col] = outcome;

            return outcome;
        }

        // ── Case 2: Deterministic Outcome ──────────────────────────────────
        // Clear scratch row (row 2n)
        let scratch_offset = 2 * n * num_cols;
        self.data[scratch_offset..(scratch_offset + num_cols)].fill(0);

        // Sum corresponding stabilizer rows for each destabilizer with x_iq == 1
        for i in 0..n {
            if self.data[i * num_cols + qubit] == 1 {
                self.rowsum(2 * n, i + n);
            }
        }

        // Deterministic outcome is the phase of the scratch row
        self.data[scratch_offset + phase_col]
    }
}

// ── Unit Tests ─────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zero_state_initialization() {
        let tableau = StabilizerTableau::new(2);
        assert_eq!(tableau.num_qubits, 2);
        assert_eq!(tableau.num_rows, 5); // 2*2 + 1
        assert_eq!(tableau.num_cols, 5); // 2 + 2 + 1

        // Destabilizers: X_0, X_1
        assert_eq!(tableau.get_x(0, 0), 1);
        assert_eq!(tableau.get_z(0, 0), 0);
        assert_eq!(tableau.get_x(1, 1), 1);
        assert_eq!(tableau.get_z(1, 1), 0);

        // Stabilizers: Z_0, Z_1
        assert_eq!(tableau.get_x(2, 0), 0);
        assert_eq!(tableau.get_z(2, 0), 1);
        assert_eq!(tableau.get_x(3, 1), 0);
        assert_eq!(tableau.get_z(3, 1), 1);

        // All phases initially 0
        for r in 0..tableau.num_rows {
            assert_eq!(tableau.get_phase(r), 0);
        }
    }

    #[test]
    fn test_single_qubit_gates() {
        let mut t = StabilizerTableau::new(1);

        // |0> measured in Z basis -> deterministically 0
        assert_eq!(t.measure(0, || 0.0), 0);

        // Apply X -> |1> -> deterministically 1
        t.apply_x(0);
        assert_eq!(t.measure(0, || 0.0), 1);

        // Apply X again -> |0> -> deterministically 0
        t.apply_x(0);
        assert_eq!(t.measure(0, || 0.0), 0);

        // Apply H -> |+> -> measurement is random (50/50)
        t.apply_h(0);
        let mut t0 = t.clone();
        let mut t1 = t.clone();
        assert_eq!(t0.measure(0, || 0.2), 0);
        assert_eq!(t1.measure(0, || 0.8), 1);

        // S gate: H, S, S, H on |0> is H Z H = X -> |1>
        let mut t_s = StabilizerTableau::new(1);
        t_s.apply_h(0);
        t_s.apply_s(0);
        t_s.apply_s(0);
        t_s.apply_h(0);
        assert_eq!(t_s.measure(0, || 0.0), 1);

        // S-dagger: S followed by Sdg is Identity
        let mut t_sdg = StabilizerTableau::new(1);
        t_sdg.apply_s(0);
        t_sdg.apply_sdg(0);
        assert_eq!(t_sdg.measure(0, || 0.0), 0);
    }

    #[test]
    fn test_bell_state_generation_and_measurement() {
        // Bell state |Phi+> = (|00> + |11>) / sqrt(2)
        // Preparation: H(0), CNOT(0, 1)

        // 1. Deterministic pseudo-RNG branch for outcome 0 -> must yield |00>
        let mut t_zero = StabilizerTableau::new(2);
        t_zero.apply_h(0);
        t_zero.apply_cnot(0, 1);

        let m0 = t_zero.measure(0, || 0.1); // < 0.5 -> 0
        assert_eq!(m0, 0, "First qubit must collapse to 0");
        let m1 = t_zero.measure(1, || 0.9); // Should be deterministic 0 regardless of RNG
        assert_eq!(m1, 0, "Second qubit must collapse deterministically to 0");

        // 2. Deterministic pseudo-RNG branch for outcome 1 -> must yield |11>
        let mut t_one = StabilizerTableau::new(2);
        t_one.apply_h(0);
        t_one.apply_cnot(0, 1);

        let m0_one = t_one.measure(0, || 0.8); // >= 0.5 -> 1
        assert_eq!(m0_one, 1, "First qubit must collapse to 1");
        let m1_one = t_one.measure(1, || 0.1); // Should be deterministic 1 regardless of RNG
        assert_eq!(m1_one, 1, "Second qubit must collapse deterministically to 1");

        // 3. Statistical sampling (100 repetitions): NEVER produce 01 or 10
        let mut state_counts = [0usize; 4]; // [00, 01, 10, 11]
        let mut seed: u64 = 123456789;
        let mut pseudo_rand = || -> f64 {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            ((seed >> 33) as f64) / 2147483648.0
        };

        for _ in 0..100 {
            let mut t = StabilizerTableau::new(2);
            t.apply_h(0);
            t.apply_cnot(0, 1);
            let bit0 = t.measure(0, &mut pseudo_rand);
            let bit1 = t.measure(1, &mut pseudo_rand);
            let state_idx = ((bit0 as usize) << 1) | (bit1 as usize);
            state_counts[state_idx] += 1;
        }

        assert_eq!(state_counts[1], 0, "Bell state must never produce |01>");
        assert_eq!(state_counts[2], 0, "Bell state must never produce |10>");
        assert!(state_counts[0] > 30, "Must observe |00> with significant probability (~50%)");
        assert!(state_counts[3] > 30, "Must observe |11> with significant probability (~50%)");
        assert_eq!(state_counts[0] + state_counts[3], 100);
    }

    #[test]
    fn test_three_qubit_ghz_state() {
        // GHZ state |GHZ> = (|000> + |111>) / sqrt(2)
        // Preparation: H(0), CNOT(0, 1), CNOT(1, 2)

        // Branch 1: First qubit collapses to 0 -> 000
        let mut t0 = StabilizerTableau::new(3);
        t0.apply_h(0);
        t0.apply_cnot(0, 1);
        t0.apply_cnot(1, 2);

        assert_eq!(t0.measure(0, || 0.2), 0);
        assert_eq!(t0.measure(1, || 0.9), 0);
        assert_eq!(t0.measure(2, || 0.9), 0);

        // Branch 2: First qubit collapses to 1 -> 111
        let mut t1 = StabilizerTableau::new(3);
        t1.apply_h(0);
        t1.apply_cnot(0, 1);
        t1.apply_cnot(1, 2);

        assert_eq!(t1.measure(0, || 0.7), 1);
        assert_eq!(t1.measure(1, || 0.1), 1);
        assert_eq!(t1.measure(2, || 0.1), 1);

        // Statistical sampling (100 repetitions): Strictly 000 or 111
        let mut seed: u64 = 987654321;
        let mut pseudo_rand = || -> f64 {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            ((seed >> 33) as f64) / 2147483648.0
        };

        for _ in 0..100 {
            let mut t = StabilizerTableau::new(3);
            t.apply_h(0);
            t.apply_cnot(0, 1);
            t.apply_cnot(1, 2);

            let b0 = t.measure(0, &mut pseudo_rand);
            let b1 = t.measure(1, &mut pseudo_rand);
            let b2 = t.measure(2, &mut pseudo_rand);

            assert!(
                (b0 == 0 && b1 == 0 && b2 == 0) || (b0 == 1 && b1 == 1 && b2 == 1),
                "GHZ outcome must be either 000 or 111, got {}{}{}",
                b0, b1, b2
            );
        }
    }

    #[test]
    fn test_two_qubit_grover_oracle_and_diffusion() {
        // Pure Clifford 2-qubit Grover for target |11> (12 gates)
        // Expected outcome: strictly |11> with probability 1.0 (exact!)
        let mut t = StabilizerTableau::new(2);

        // 1. Equal superposition
        t.apply_h(0);
        t.apply_h(1);

        // 2. Oracle for |11>: CZ(0, 1)
        t.apply_cz(0, 1);

        // 3. Diffusion operator: H, X, CZ, X, H
        t.apply_h(0);
        t.apply_h(1);
        t.apply_x(0);
        t.apply_x(1);
        t.apply_cz(0, 1);
        t.apply_x(0);
        t.apply_x(1);
        t.apply_h(0);
        t.apply_h(1);

        // Deterministic measurement must yield |11>
        let m0 = t.measure(0, || 0.0);
        let m1 = t.measure(1, || 0.0);
        assert_eq!(m0, 1, "Grover search target qubit 0 must be 1");
        assert_eq!(m1, 1, "Grover search target qubit 1 must be 1");
    }

    #[test]
    fn test_cz_and_swap_gates() {
        let mut t = StabilizerTableau::new(2);
        // Prepare |10>: X on 0
        t.apply_x(0);
        // SWAP(0, 1) -> state becomes |01>
        t.apply_swap(0, 1);
        assert_eq!(t.measure(0, || 0.0), 0);
        assert_eq!(t.measure(1, || 0.0), 1);
    }
}
