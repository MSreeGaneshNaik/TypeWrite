import Foundation

/// How one strike of a type bar landed on the paper.
struct InkStrike: Equatable, Sendable {
    /// Horizontal nudge in points.
    var dx: Double
    /// Baseline shift in points; positive moves the glyph down.
    var dy: Double
    /// Tilt in radians.
    var rotation: Double
    /// Ink density of the main impression, 0...1.
    var opacity: Double
    /// Density of the faint second impression that reads as ink bleed, 0...1.
    var bleed: Double
}

/// Deterministic imperfection for every typed character. The same sheet seed
/// and character index always give the same strike, so a page never shimmers
/// when it is redrawn.
enum InkJitter {

    static func strike(seed: UInt64, index: Int) -> InkStrike {
        var random = SplitMix64(seed: seed ^ (UInt64(truncatingIfNeeded: index) &* 0x9E37_79B9_7F4A_7C15))
        let dx = random.symmetric(0.35)
        let dy = random.symmetric(0.6)
        let rotation = random.symmetric(1.1) * .pi / 180
        let roll = random.unit()

        var opacity = 0.84 + random.unit() * 0.16
        var bleed = 0.16 + random.unit() * 0.12
        if roll < 0.06 {
            // A light strike: the key was barely pressed.
            opacity = 0.5 + random.unit() * 0.15
            bleed = 0.06
        } else if roll > 0.96 {
            // A heavy strike: fresh ribbon, firm finger.
            opacity = 1
            bleed = 0.34
        }
        return InkStrike(dx: dx, dy: dy, rotation: rotation, opacity: opacity, bleed: bleed)
    }
}

/// Small, fast, seedable generator (Steele, Lea and Flood's SplitMix64).
struct SplitMix64: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed
    }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }

    /// A value in 0..<1.
    mutating func unit() -> Double {
        Double(next() >> 11) / Double(1 << 53)
    }

    /// A value in -range...range.
    mutating func symmetric(_ range: Double) -> Double {
        (unit() * 2 - 1) * range
    }
}
