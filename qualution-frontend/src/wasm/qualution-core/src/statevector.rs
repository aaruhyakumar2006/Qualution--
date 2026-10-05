//! statevector.rs
//!
//! High-performance quantum statevector engine in Rust/WebAssembly.
//! Implements arbitrary non-Clifford quantum circuit simulation via in-place
//! tensor-index bit manipulation on dual Float64 buffers (real and imaginary).
//!
//! Strict memory ceiling: strictly capped at <= 20 qubits (~16 MB RAM) to protect
//! client browser memory limits from exponential statevector allocation.

pub struct QuantumStatevector {
    pub num_qubits: usize,
    pub size: usize,
    pub real: Vec<f64>,
    pub imag: Vec<f64>,
}

impl QuantumStatevector {
    /// Creates and initializes a new quantum statevector in the |0...0> ground state.
    pub fn new(num_qubits: usize) -> Result<Self, String> {
        if num_qubits < 1 || num_qubits > 20 {
            return Err(format!(
                "Statevector simulation requires between 1 and 20 qubits, got {}",
                num_qubits
            ));
        }

        let size = 1usize << num_qubits;
        let mut real = vec![0.0f64; size];
        let imag = vec![0.0f64; size];

        // Ground state |0...0> amplitude = 1.0
        real[0] = 1.0;

        Ok(Self {
            num_qubits,
            size,
            real,
            imag,
        })
    }

    /// Applies an arbitrary 2x2 single-qubit unitary matrix in-place:
    /// U = [[u00_r + i*u00_i, u01_r + i*u01_i], [u10_r + i*u10_i, u11_r + i*u11_i]]
    pub fn apply_single_qubit_matrix(
        &mut self,
        target: usize,
        u00_r: f64, u00_i: f64,
        u01_r: f64, u01_i: f64,
        u10_r: f64, u10_i: f64,
        u11_r: f64, u11_i: f64,
    ) {
        let total = self.size;
        let half_step = 1usize << target;
        let step = half_step << 1;

        for base in (0..total).step_by(step) {
            for j in 0..half_step {
                let i0 = base + j;
                let i1 = i0 + half_step;

                let r0 = self.real[i0];
                let c0 = self.imag[i0];
                let r1 = self.real[i1];
                let c1 = self.imag[i1];

                self.real[i0] = (u00_r * r0 - u00_i * c0) + (u01_r * r1 - u01_i * c1);
                self.imag[i0] = (u00_r * c0 + u00_i * r0) + (u01_r * c1 + u01_i * r1);

                self.real[i1] = (u10_r * r0 - u10_i * c0) + (u11_r * r1 - u11_i * c1);
                self.imag[i1] = (u10_r * c0 + u10_i * r0) + (u11_r * c1 + u11_i * r1);
            }
        }
    }

    // ── Single-Qubit Fast-Path Gates ───────────────────────────────────────

    /// Hadamard Gate H: 1/sqrt(2) * [[1, 1], [1, -1]]
    pub fn apply_h(&mut self, target: usize) {
        let inv_sqrt2 = std::f64::consts::FRAC_1_SQRT_2;
        let total = self.size;
        let half_step = 1usize << target;
        let step = half_step << 1;

        for base in (0..total).step_by(step) {
            for j in 0..half_step {
                let i0 = base + j;
                let i1 = i0 + half_step;

                let r0 = self.real[i0];
                let c0 = self.imag[i0];
                let r1 = self.real[i1];
                let c1 = self.imag[i1];

                self.real[i0] = (r0 + r1) * inv_sqrt2;
                self.imag[i0] = (c0 + c1) * inv_sqrt2;
                self.real[i1] = (r0 - r1) * inv_sqrt2;
                self.imag[i1] = (c0 - c1) * inv_sqrt2;
            }
        }
    }

    /// Pauli X Gate (Bit-flip): [[0, 1], [1, 0]]
    pub fn apply_x(&mut self, target: usize) {
        let total = self.size;
        let half_step = 1usize << target;
        let step = half_step << 1;

        for base in (0..total).step_by(step) {
            for j in 0..half_step {
                let i0 = base + j;
                let i1 = i0 + half_step;

                let r0 = self.real[i0];
                let c0 = self.imag[i0];
                self.real[i0] = self.real[i1];
                self.imag[i0] = self.imag[i1];
                self.real[i1] = r0;
                self.imag[i1] = c0;
            }
        }
    }

    /// Pauli Y Gate: [[0, -i], [i, 0]]
    pub fn apply_y(&mut self, target: usize) {
        let total = self.size;
        let half_step = 1usize << target;
        let step = half_step << 1;

        for base in (0..total).step_by(step) {
            for j in 0..half_step {
                let i0 = base + j;
                let i1 = i0 + half_step;

                let r0 = self.real[i0];
                let c0 = self.imag[i0];
                let r1 = self.real[i1];
                let c1 = self.imag[i1];

                // i0' = -i * psi1 = (c1, -r1)
                self.real[i0] = c1;
                self.imag[i0] = -r1;
                // i1' = i * psi0 = (-c0, r0)
                self.real[i1] = -c0;
                self.imag[i1] = r0;
            }
        }
    }

    /// Pauli Z Gate (Phase-flip): [[1, 0], [0, -1]]
    pub fn apply_z(&mut self, target: usize) {
        let total = self.size;
        let half_step = 1usize << target;
        let step = half_step << 1;

        for base in (0..total).step_by(step) {
            for j in 0..half_step {
                let i1 = base + j + half_step;
                self.real[i1] = -self.real[i1];
                self.imag[i1] = -self.imag[i1];
            }
        }
    }

    /// Phase Gate S: [[1, 0], [0, i]]
    pub fn apply_s(&mut self, target: usize) {
        let total = self.size;
        let half_step = 1usize << target;
        let step = half_step << 1;

        for base in (0..total).step_by(step) {
            for j in 0..half_step {
                let i1 = base + j + half_step;
                let r1 = self.real[i1];
                let c1 = self.imag[i1];
                self.real[i1] = -c1;
                self.imag[i1] = r1;
            }
        }
    }

    /// S-Dagger Gate Sdg: [[1, 0], [0, -i]]
    pub fn apply_sdg(&mut self, target: usize) {
        let total = self.size;
        let half_step = 1usize << target;
        let step = half_step << 1;

        for base in (0..total).step_by(step) {
            for j in 0..half_step {
                let i1 = base + j + half_step;
                let r1 = self.real[i1];
                let c1 = self.imag[i1];
                self.real[i1] = c1;
                self.imag[i1] = -r1;
            }
        }
    }

    /// T Gate (pi/8 gate): [[1, 0], [0, e^(i*pi/4)]]
    pub fn apply_t(&mut self, target: usize) {
        let inv_sqrt2 = std::f64::consts::FRAC_1_SQRT_2;
        let total = self.size;
        let half_step = 1usize << target;
        let step = half_step << 1;

        for base in (0..total).step_by(step) {
            for j in 0..half_step {
                let i1 = base + j + half_step;
                let r1 = self.real[i1];
                let c1 = self.imag[i1];
                self.real[i1] = (r1 - c1) * inv_sqrt2;
                self.imag[i1] = (r1 + c1) * inv_sqrt2;
            }
        }
    }

    /// T-Dagger Gate: [[1, 0], [0, e^(-i*pi/4)]]
    pub fn apply_tdg(&mut self, target: usize) {
        let inv_sqrt2 = std::f64::consts::FRAC_1_SQRT_2;
        let total = self.size;
        let half_step = 1usize << target;
        let step = half_step << 1;

        for base in (0..total).step_by(step) {
            for j in 0..half_step {
                let i1 = base + j + half_step;
                let r1 = self.real[i1];
                let c1 = self.imag[i1];
                self.real[i1] = (r1 + c1) * inv_sqrt2;
                self.imag[i1] = (c1 - r1) * inv_sqrt2;
            }
        }
    }

    /// Arbitrary Rotation RX(theta): cos(theta/2)*I - i*sin(theta/2)*X
    pub fn apply_rx(&mut self, target: usize, theta: f64) {
        let half = theta * 0.5;
        let c = half.cos();
        let s = half.sin();
        let total = self.size;
        let half_step = 1usize << target;
        let step = half_step << 1;

        for base in (0..total).step_by(step) {
            for j in 0..half_step {
                let i0 = base + j;
                let i1 = i0 + half_step;

                let r0 = self.real[i0];
                let c0 = self.imag[i0];
                let r1 = self.real[i1];
                let c1 = self.imag[i1];

                self.real[i0] = c * r0 + s * c1;
                self.imag[i0] = c * c0 - s * r1;

                self.real[i1] = s * c0 + c * r1;
                self.imag[i1] = -s * r0 + c * c1;
            }
        }
    }

    /// Arbitrary Rotation RY(theta): cos(theta/2)*I - sin(theta/2)*(i*Y)
    pub fn apply_ry(&mut self, target: usize, theta: f64) {
        let half = theta * 0.5;
        let c = half.cos();
        let s = half.sin();
        let total = self.size;
        let half_step = 1usize << target;
        let step = half_step << 1;

        for base in (0..total).step_by(step) {
            for j in 0..half_step {
                let i0 = base + j;
                let i1 = i0 + half_step;

                let r0 = self.real[i0];
                let c0 = self.imag[i0];
                let r1 = self.real[i1];
                let c1 = self.imag[i1];

                self.real[i0] = c * r0 - s * r1;
                self.imag[i0] = c * c0 - s * c1;

                self.real[i1] = s * r0 + c * r1;
                self.imag[i1] = s * c0 + c * c1;
            }
        }
    }

    /// Arbitrary Rotation RZ(theta): diag(e^(-i*theta/2), e^(i*theta/2))
    pub fn apply_rz(&mut self, target: usize, theta: f64) {
        let half = theta * 0.5;
        let cos_val = half.cos();
        let sin_val = half.sin();
        let total = self.size;
        let half_step = 1usize << target;
        let step = half_step << 1;

        for base in (0..total).step_by(step) {
            for j in 0..half_step {
                let i0 = base + j;
                let i1 = i0 + half_step;

                let r0 = self.real[i0];
                let c0 = self.imag[i0];
                let r1 = self.real[i1];
                let c1 = self.imag[i1];

                self.real[i0] = cos_val * r0 + sin_val * c0;
                self.imag[i0] = cos_val * c0 - sin_val * r0;

                self.real[i1] = cos_val * r1 - sin_val * c1;
                self.imag[i1] = cos_val * c1 + sin_val * r1;
            }
        }
    }

    /// Phase Shift Gate P(lambda): diag(1, e^(i*lambda))
    pub fn apply_p(&mut self, target: usize, lambda: f64) {
        let cos_val = lambda.cos();
        let sin_val = lambda.sin();
        let total = self.size;
        let half_step = 1usize << target;
        let step = half_step << 1;

        for base in (0..total).step_by(step) {
            for j in 0..half_step {
                let i1 = base + j + half_step;
                let r1 = self.real[i1];
                let c1 = self.imag[i1];

                self.real[i1] = cos_val * r1 - sin_val * c1;
                self.imag[i1] = sin_val * r1 + cos_val * c1;
            }
        }
    }

    // ── Controlled Two-Qubit Gates ─────────────────────────────────────────

    /// Controlled-NOT Gate CNOT: |c, t> -> |c, c ^ t>
    pub fn apply_cnot(&mut self, control: usize, target: usize) {
        let c_mask = 1usize << control;
        let t_mask = 1usize << target;
        let total = self.size;

        for k in 0..total {
            if (k & c_mask) != 0 && (k & t_mask) == 0 {
                let partner = k | t_mask;
                let r = self.real[k];
                let c = self.imag[k];
                self.real[k] = self.real[partner];
                self.imag[k] = self.imag[partner];
                self.real[partner] = r;
                self.imag[partner] = c;
            }
        }
    }

    /// Controlled-Z Gate CZ: diag(1, 1, 1, -1)
    pub fn apply_cz(&mut self, control: usize, target: usize) {
        let mask = (1usize << control) | (1usize << target);
        let total = self.size;

        for k in 0..total {
            if (k & mask) == mask {
                self.real[k] = -self.real[k];
                self.imag[k] = -self.imag[k];
            }
        }
    }

    /// SWAP Gate: |a, b> -> |b, a>
    pub fn apply_swap(&mut self, qubit_a: usize, qubit_b: usize) {
        if qubit_a == qubit_b {
            return;
        }
        let mask_a = 1usize << qubit_a;
        let mask_b = 1usize << qubit_b;
        let total = self.size;

        for k in 0..total {
            if (k & mask_a) != 0 && (k & mask_b) == 0 {
                let partner = (k ^ mask_a) | mask_b;
                let r = self.real[k];
                let c = self.imag[k];
                self.real[k] = self.real[partner];
                self.imag[k] = self.imag[partner];
                self.real[partner] = r;
                self.imag[partner] = c;
            }
        }
    }
}

// ── Unit Tests ─────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zero_state_initialization() {
        let sv = QuantumStatevector::new(2).unwrap();
        assert_eq!(sv.num_qubits, 2);
        assert_eq!(sv.size, 4);
        assert_eq!(sv.real[0], 1.0);
        assert_eq!(sv.imag[0], 0.0);
        for i in 1..4 {
            assert_eq!(sv.real[i], 0.0);
            assert_eq!(sv.imag[i], 0.0);
        }
    }

    #[test]
    fn test_bell_state_construction() {
        // H(0), CNOT(0, 1) -> 1/sqrt(2) * (|00> + |11>)
        let mut sv = QuantumStatevector::new(2).unwrap();
        sv.apply_h(0);
        sv.apply_cnot(0, 1);

        let inv_sqrt2 = std::f64::consts::FRAC_1_SQRT_2;
        assert!((sv.real[0] - inv_sqrt2).abs() < 1e-12);
        assert!((sv.real[3] - inv_sqrt2).abs() < 1e-12);
        assert_eq!(sv.real[1], 0.0);
        assert_eq!(sv.real[2], 0.0);
    }

    #[test]
    fn test_non_clifford_rx() {
        // RX(pi/3) on |0>: P(0) = 0.75, P(1) = 0.25
        let mut sv = QuantumStatevector::new(1).unwrap();
        sv.apply_rx(0, std::f64::consts::PI / 3.0);

        let p0 = sv.real[0] * sv.real[0] + sv.imag[0] * sv.imag[0];
        let p1 = sv.real[1] * sv.real[1] + sv.imag[1] * sv.imag[1];

        assert!((p0 - 0.75).abs() < 1e-12);
        assert!((p1 - 0.25).abs() < 1e-12);
    }

    #[test]
    fn test_t_gate_hth() {
        // H -> T -> H on |0>: P(0) = (2 + sqrt(2))/4 ≈ 0.853553
        let mut sv = QuantumStatevector::new(1).unwrap();
        sv.apply_h(0);
        sv.apply_t(0);
        sv.apply_h(0);

        let p0 = sv.real[0] * sv.real[0] + sv.imag[0] * sv.imag[0];
        let expected = (2.0 + std::f64::consts::SQRT_2) / 4.0;
        assert!((p0 - expected).abs() < 1e-12);
    }
}
